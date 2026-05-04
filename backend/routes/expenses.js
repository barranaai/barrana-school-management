/**
 * /api/expenses — School-admin Expense Management
 *
 * Admin-only domain. RBAC: `school_admin` and `super_admin`.
 *
 * Endpoints:
 *   GET    /enums                                       canonical lists for UI
 *   GET    /stats?from&to                               aggregated counters
 *   GET    /                                            list (filters, paginated)
 *   GET    /:id                                         get one
 *   POST   /                                            create
 *   PUT    /:id                                         edit (rejected if locked)
 *   DELETE /:id                                         soft-void
 *   POST   /:id/lock                                    toggle compliance lock
 *   POST   /:id/attachments                             multer, ≤10 files
 *   DELETE /:id/attachments/:attachmentId               remove a single file
 *   GET    /:id/attachments/:attachmentId/download      auth-gated stream
 *   POST   /ocr                                         single receipt → parsed JSON
 *
 * Money is stored as integer CAD cents on the model. The wire format is
 * decimal major units (e.g. 12.50). Conversion happens here at the edges
 * via majorToCents / centsToMajor so the rest of the API stays clean.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const { protect, authorize } = require('../middleware/auth');
const Expense = require('../models/Expense');
const School = require('../models/School');
const { extractFromReceipt } = require('../services/expenseOcrService');
const expenseReportService = require('../services/expenseReportService');
const { generatePDF } = require('../services/pdfService');
const { logger } = require('../utils/logger');

const ADMIN_ROLES = ['school_admin', 'super_admin'];
const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const RECEIPTS_DIR = path.join(__dirname, '..', 'uploads', 'expense-receipts');

// ─── Multer disk storage (private; never served via /uploads) ───────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
      cb(null, RECEIPTS_DIR);
    } catch (err) {
      cb(null, '/tmp');
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ts = Date.now();
    const rand = Math.round(Math.random() * 1e9);
    const tag = req.params.id || 'tmp';
    cb(null, `expense-${tag}-${ts}-${rand}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /^(image\/(jpeg|jpg|png|webp|heic|heif|gif)|application\/pdf)$/i;
  if (allowed.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only images (jpeg/png/webp/heic/gif) and PDFs are accepted.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_ATTACHMENTS },
});

// ─── OCR-specific rate limiter (protects OpenAI spend) ──────────────────
const ocrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many OCR requests; please wait a few minutes and try again.',
  },
});

// ─── Money helpers ──────────────────────────────────────────────────────

/** Decimal major units → integer CAD cents. Returns 0 for null/invalid. */
function majorToCents(n) {
  if (n === null || n === undefined || n === '') return 0;
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100);
}

/** Integer CAD cents → number (major units, 2 decimals). */
function centsToMajor(c) {
  if (!Number.isFinite(c)) return 0;
  return Math.round(c) / 100;
}

/**
 * Convert a saved Expense doc into the wire shape (cents → major units).
 * Mongoose .lean() / .toObject() produces a plain object we mutate.
 */
function toWire(docOrLean) {
  if (!docOrLean) return docOrLean;
  const e =
    typeof docOrLean.toObject === 'function' ? docOrLean.toObject() : { ...docOrLean };

  if (Array.isArray(e.taxes)) {
    e.taxes = e.taxes.map((t) => ({ ...t, amount: centsToMajor(t.amount) }));
  }
  if (Array.isArray(e.lineItems)) {
    e.lineItems = e.lineItems.map((li) => ({
      ...li,
      amount: centsToMajor(li.amount),
    }));
  }
  if (Array.isArray(e.attachments)) {
    e.attachments = e.attachments.map((a) => {
      const aa = typeof a.toObject === 'function' ? a.toObject() : { ...a };
      // never expose internal storagePath to clients
      delete aa.storagePath;
      // synthesize a download URL pointing at our auth-gated route
      aa.url = `/api/expenses/${e._id}/attachments/${aa._id}/download`;
      return aa;
    });
  }
  e.subtotal = centsToMajor(e.subtotal);
  e.taxTotal = centsToMajor(e.taxTotal);
  e.total = centsToMajor(e.total);
  return e;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function normalizeSchoolId(schoolId) {
  if (!schoolId) return null;
  if (typeof schoolId === 'string') return schoolId;
  if (schoolId._id) return schoolId._id.toString();
  return schoolId.toString();
}

/** Centralized scoping: super_admin sees all, school_admin only own school. */
function scopeQueryToUser(user) {
  if (user.role === 'super_admin') return {};
  return { schoolId: normalizeSchoolId(user.schoolId) };
}

/** Reject mutations on locked records — admin must unlock first. */
function ensureNotLocked(expense, res) {
  if (expense.isLocked) {
    res.status(423).json({
      success: false,
      error: 'expense_locked',
      message: 'This expense is locked for compliance and cannot be modified. Unlock it first.',
    });
    return false;
  }
  return true;
}

function appendEditHistory(expense, user, summary, fieldsChanged = []) {
  expense.editHistory.push({
    editedAt: new Date(),
    editedBy: user._id,
    summary,
    fieldsChanged,
  });
}

/** Map an incoming wire body to model fields, converting money to cents. */
function mapBodyToFields(body) {
  const out = {};
  if (body.incurredAt !== undefined) out.incurredAt = body.incurredAt;
  if (body.category !== undefined) out.category = body.category;
  if (body.subcategory !== undefined) out.subcategory = body.subcategory;
  if (body.vendorName !== undefined) out.vendorName = body.vendorName;
  if (body.description !== undefined) out.description = body.description;
  if (body.tags !== undefined) out.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.paymentMethod !== undefined) out.paymentMethod = body.paymentMethod;
  if (body.paymentReference !== undefined) out.paymentReference = body.paymentReference;
  if (body.isPaid !== undefined) out.isPaid = !!body.isPaid;
  if (body.paidAt !== undefined) out.paidAt = body.paidAt || null;

  if (body.subtotal !== undefined) out.subtotal = majorToCents(body.subtotal);
  if (body.total !== undefined) out.total = majorToCents(body.total);
  if (Array.isArray(body.taxes)) {
    out.taxes = body.taxes
      .filter((t) => t && Expense.TAX_TYPES.includes(t.type))
      .map((t) => ({
        type: t.type,
        rate: typeof t.rate === 'number' ? t.rate : null,
        amount: majorToCents(t.amount),
      }));
  }
  if (Array.isArray(body.lineItems)) {
    out.lineItems = body.lineItems
      .filter((li) => li && (li.description || li.amount !== undefined))
      .slice(0, 30)
      .map((li) => ({
        description: String(li.description || '').slice(0, 200),
        amount: majorToCents(li.amount),
      }));
  }
  return out;
}

const POPULATE = [
  { path: 'recordedBy', select: 'firstName lastName email role' },
  { path: 'voidedBy', select: 'firstName lastName' },
  { path: 'lockedBy', select: 'firstName lastName' },
  { path: 'editHistory.editedBy', select: 'firstName lastName' },
  { path: 'attachments.uploadedBy', select: 'firstName lastName' },
];

// ─── Routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/expenses/enums
 * Returns canonical enums so the UI renders dropdowns from one source.
 */
router.get('/enums', protect, authorize(...ADMIN_ROLES), (_req, res) => {
  res.json({
    success: true,
    data: {
      categories: Expense.CATEGORIES,
      paymentMethods: Expense.PAYMENT_METHODS,
      taxTypes: Expense.TAX_TYPES,
      statuses: Expense.STATUSES,
      currency: 'CAD',
      maxAttachments: MAX_ATTACHMENTS,
    },
  });
});

/**
 * GET /api/expenses/stats?from=&to=
 * Lightweight stats for the list-page hero cards. Phase 2 will add
 * full reports (groupBy, charts, exports) on a separate /reports endpoint.
 */
router.get('/stats', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const baseQuery = scopeQueryToUser(req.user);
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [counts, monthAgg, mtdAgg, ytdAgg] = await Promise.all([
      Expense.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { ...baseQuery, status: 'recorded', incurredAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        {
          $match: {
            ...baseQuery,
            status: 'recorded',
            incurredAt: { $gte: startOfMonth() },
          },
        },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        {
          $match: {
            ...baseQuery,
            status: 'recorded',
            incurredAt: { $gte: startOfYear() },
          },
        },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
    ]);

    const byStatus = counts.reduce((acc, x) => ({ ...acc, [x._id]: x.count }), {});
    res.json({
      success: true,
      data: {
        byStatus,
        last30Days: {
          total: centsToMajor(monthAgg[0]?.total || 0),
          count: monthAgg[0]?.count || 0,
        },
        monthToDate: {
          total: centsToMajor(mtdAgg[0]?.total || 0),
          count: mtdAgg[0]?.count || 0,
        },
        yearToDate: {
          total: centsToMajor(ytdAgg[0]?.total || 0),
          count: ytdAgg[0]?.count || 0,
        },
        currency: 'CAD',
      },
    });
  } catch (err) {
    logger.error('Expense stats error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1);
}

/**
 * GET /api/expenses
 * Filters: status, category, vendor (regex), from, to, q (text), paymentMethod
 * Pagination: page (1-based), limit (max 200)
 */
router.get('/', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const query = scopeQueryToUser(req.user);
    if (req.query.status) query.status = req.query.status;
    if (req.query.category) query.category = req.query.category;
    if (req.query.paymentMethod) query.paymentMethod = req.query.paymentMethod;
    if (req.query.vendor) {
      query.vendorName = { $regex: String(req.query.vendor), $options: 'i' };
    }
    if (req.query.from || req.query.to) {
      query.incurredAt = {};
      if (req.query.from) query.incurredAt.$gte = new Date(req.query.from);
      if (req.query.to) query.incurredAt.$lte = new Date(req.query.to);
    }
    if (req.query.q) {
      const q = String(req.query.q);
      query.$or = [
        { expenseNumber: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { vendorName: { $regex: q, $options: 'i' } },
        { 'tags': { $regex: q, $options: 'i' } },
      ];
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      Expense.find(query)
        .populate(POPULATE)
        .sort({ incurredAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Expense.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: docs.map(toWire),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('List expenses error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Phase 2: Reports & Analytics ───────────────────────────────────────

/**
 * Validate & coerce a dimension query param.
 * @returns {string|null}
 */
function parseDimension(raw) {
  const allowed = ['category', 'paymentMethod', 'vendor', 'taxType', 'day', 'week', 'month', 'year'];
  return allowed.includes(raw) ? raw : null;
}

function parseBoolean(raw, fallback = false) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  return raw === '1' || raw === 'true' || raw === true;
}

/**
 * GET /api/expenses/reports/summary?from=&to=&includeVoid=
 * High-level KPIs for the analytics overview.
 */
router.get('/reports/summary', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const baseScope = scopeQueryToUser(req.user);
    const summary = await expenseReportService.getSummary({
      baseScope,
      from: req.query.from,
      to: req.query.to,
      includeVoid: parseBoolean(req.query.includeVoid),
    });
    res.json({ success: true, data: summary });
  } catch (err) {
    logger.error('Expense report summary error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/expenses/reports/group?dimension=&from=&to=&limit=
 * Aggregations for charts (category pie, paymentMethod bar, monthly trend, etc.).
 */
router.get('/reports/group', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const dimension = parseDimension(req.query.dimension);
    if (!dimension) {
      return res.status(400).json({
        success: false,
        error:
          'Invalid dimension. Allowed: category, paymentMethod, vendor, taxType, day, week, month, year.',
      });
    }
    const baseScope = scopeQueryToUser(req.user);
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10) || 0, 100) : 0;
    const rows = await expenseReportService.groupBy({
      baseScope,
      from: req.query.from,
      to: req.query.to,
      dimension,
      includeVoid: parseBoolean(req.query.includeVoid),
      limit,
    });
    res.json({ success: true, data: rows, dimension });
  } catch (err) {
    logger.error('Expense report group error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/expenses/reports/top-vendors?from=&to=&limit=
 * Convenience endpoint: top N vendors by spend.
 */
router.get('/reports/top-vendors', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const baseScope = scopeQueryToUser(req.user);
    const rows = await expenseReportService.getTopVendors({
      baseScope,
      from: req.query.from,
      to: req.query.to,
      limit: Math.min(parseInt(req.query.limit, 10) || 10, 50),
      includeVoid: parseBoolean(req.query.includeVoid),
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('Top vendors error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/expenses/reports/tax-breakdown?from=&to=
 * GST/HST/PST/QST breakdown for a range.
 */
router.get('/reports/tax-breakdown', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const baseScope = scopeQueryToUser(req.user);
    const rows = await expenseReportService.getTaxBreakdown({
      baseScope,
      from: req.query.from,
      to: req.query.to,
      includeVoid: parseBoolean(req.query.includeVoid),
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('Tax breakdown error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/expenses/export?format=csv|pdf&from=&to=&category=&paymentMethod=&includeVoid=
 *
 * CSV: streamed back as text/csv with Content-Disposition.
 * PDF: rendered via puppeteer + a self-contained HTML report (summary +
 *      groupings + detailed rows for the range).
 *
 * Auth-gated; CSRF-safe (Bearer token); admin-only.
 */
router.get('/export', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ success: false, error: 'format must be csv or pdf' });
    }

    const baseScope = scopeQueryToUser(req.user);
    const from = req.query.from;
    const to = req.query.to;
    const includeVoid = parseBoolean(req.query.includeVoid);
    const filters = {
      category: req.query.category,
      paymentMethod: req.query.paymentMethod,
      status: req.query.status,
    };

    const rows = await expenseReportService.listForExport({
      baseScope,
      from,
      to,
      includeVoid,
      filters,
    });

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const csv = expenseReportService.rowsToCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="expenses-${stamp}.csv"`
      );
      // Prepend BOM so Excel reads UTF-8 correctly
      return res.send('\uFEFF' + csv);
    }

    // ─── PDF ────────────────────────────────────────────────────────
    // Pull the school name for the header (best-effort; non-blocking).
    let schoolName = 'School';
    try {
      const sid = normalizeSchoolId(req.user.schoolId);
      if (sid) {
        const s = await School.findById(sid).select('name').lean();
        if (s?.name) schoolName = s.name;
      }
    } catch (_e) {
      // ignore — fall back to default header
    }

    const [summary, byCategory, byPaymentMethod, topVendors, taxBreakdown, byMonth] =
      await Promise.all([
        expenseReportService.getSummary({ baseScope, from, to, includeVoid }),
        expenseReportService.groupBy({ baseScope, from, to, dimension: 'category', includeVoid }),
        expenseReportService.groupBy({ baseScope, from, to, dimension: 'paymentMethod', includeVoid }),
        expenseReportService.getTopVendors({ baseScope, from, to, limit: 10, includeVoid }),
        expenseReportService.getTaxBreakdown({ baseScope, from, to, includeVoid }),
        expenseReportService.groupBy({ baseScope, from, to, dimension: 'month', includeVoid }),
      ]);

    // Cap detailed rows at 200 in PDF — anything bigger should use CSV.
    const detailedRows = rows.slice(0, 200);

    const html = expenseReportService.renderReportHtml({
      schoolName,
      from,
      to,
      summary,
      byCategory,
      byPaymentMethod,
      topVendors,
      taxBreakdown,
      byMonth,
      rows: detailedRows,
      generatedAt: new Date(),
    });

    const pdf = await generatePDF({
      html,
      filename: `expense-report-${stamp}.pdf`,
      format: 'A4',
    });

    if (!pdf || !pdf.path || !fs.existsSync(pdf.path)) {
      throw new Error('PDF generation failed');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdf.filename}"`
    );
    const stream = fs.createReadStream(pdf.path);
    stream.on('error', (e) => {
      logger.error('Expense PDF stream error', { err: e.message });
      if (!res.headersSent) res.status(500).end();
    });
    stream.on('close', () => {
      // best-effort cleanup of the temp PDF
      fs.unlink(pdf.path, () => {});
    });
    return stream.pipe(res);
  } catch (err) {
    logger.error('Expense export error', { err: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

/**
 * GET /api/expenses/:id
 */
router.get('/:id', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).populate(POPULATE);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });

    const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
    const expenseSchoolId = normalizeSchoolId(expense.schoolId);
    if (req.user.role !== 'super_admin' && requesterSchoolId !== expenseSchoolId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    res.json({ success: true, data: toWire(expense) });
  } catch (err) {
    logger.error('Get expense error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/expenses
 * Create a new expense. The route owns conversion to integer cents.
 */
router.post(
  '/',
  protect,
  authorize(...ADMIN_ROLES),
  [
    body('incurredAt').isISO8601().withMessage('incurredAt must be ISO 8601'),
    body('category').isIn(Expense.CATEGORIES).withMessage('Invalid category'),
    body('subtotal').isFloat({ min: 0 }).withMessage('subtotal must be ≥0'),
    body('total').optional().isFloat({ min: 0 }).withMessage('total must be ≥0'),
    body('vendorName').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
    body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
    body('paymentMethod')
      .optional({ checkFalsy: true })
      .isIn(Expense.PAYMENT_METHODS)
      .withMessage('Invalid payment method'),
    body('attachmentIds').optional().isArray(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ success: false, error: 'Validation failed', errors: errors.array() });
      }

      const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
      if (!requesterSchoolId) {
        return res
          .status(400)
          .json({ success: false, error: 'No school context found for requester.' });
      }

      const fields = mapBodyToFields(req.body);

      const expense = new Expense({
        ...fields,
        schoolId: requesterSchoolId,
        recordedBy: req.user._id,
        recordedAt: new Date(),
        currency: 'CAD',
        ocr: req.body.ocr || { processed: false },
      });

      // Promote any pre-uploaded receipts (from /ocr) into this expense.
      const stagedFiles = Array.isArray(req.body.attachments) ? req.body.attachments : [];
      for (const f of stagedFiles) {
        if (
          f &&
          typeof f === 'object' &&
          typeof f.storagePath === 'string' &&
          fs.existsSync(f.storagePath)
        ) {
          expense.attachments.push({
            filename: f.filename,
            originalName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
            storagePath: f.storagePath,
            uploadedBy: req.user._id,
            isReceipt: !!f.isReceipt,
          });
        }
      }

      appendEditHistory(expense, req.user, 'Expense created');
      await expense.save();
      await expense.populate(POPULATE);

      res.status(201).json({ success: true, data: toWire(expense) });
    } catch (err) {
      logger.error('Create expense error', { err: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * PUT /api/expenses/:id
 * Edit any non-status, non-lock fields. Rejected if locked.
 */
router.put('/:id', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
    if (!ensureNotLocked(expense, res)) return;

    const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
    const expenseSchoolId = normalizeSchoolId(expense.schoolId);
    if (req.user.role !== 'super_admin' && requesterSchoolId !== expenseSchoolId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const fields = mapBodyToFields(req.body);
    const fieldsChanged = [];
    for (const [k, v] of Object.entries(fields)) {
      expense[k] = v;
      fieldsChanged.push(k);
    }

    appendEditHistory(expense, req.user, 'Expense updated', fieldsChanged);
    await expense.save();
    await expense.populate(POPULATE);
    res.json({ success: true, data: toWire(expense) });
  } catch (err) {
    logger.error('Update expense error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/expenses/:id
 * Soft-delete: status flips to 'void'. Locked records cannot be voided.
 * Body may include { reason }.
 */
router.delete('/:id', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
    if (!ensureNotLocked(expense, res)) return;

    const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
    const expenseSchoolId = normalizeSchoolId(expense.schoolId);
    if (req.user.role !== 'super_admin' && requesterSchoolId !== expenseSchoolId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    expense.status = 'void';
    expense.voidedAt = new Date();
    expense.voidedBy = req.user._id;
    expense.voidReason = (req.body?.reason || '').toString().slice(0, 500);
    appendEditHistory(expense, req.user, 'Expense voided', ['status']);
    await expense.save();
    res.json({ success: true, data: toWire(expense) });
  } catch (err) {
    logger.error('Void expense error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/expenses/:id/lock
 * Toggle compliance lock. Body: { lock: boolean }
 */
router.post('/:id/lock', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });

    const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
    const expenseSchoolId = normalizeSchoolId(expense.schoolId);
    if (req.user.role !== 'super_admin' && requesterSchoolId !== expenseSchoolId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const lock = !!req.body.lock;
    expense.isLocked = lock;
    expense.lockedAt = lock ? new Date() : null;
    expense.lockedBy = lock ? req.user._id : null;
    appendEditHistory(
      expense,
      req.user,
      lock ? 'Expense locked' : 'Expense unlocked',
      ['isLocked']
    );
    await expense.save();
    await expense.populate(POPULATE);
    res.json({ success: true, data: toWire(expense) });
  } catch (err) {
    logger.error('Lock expense error', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/expenses/:id/attachments
 * Upload one or more receipts/invoices to an existing expense.
 */
router.post(
  '/:id/attachments',
  protect,
  authorize(...ADMIN_ROLES),
  upload.array('files', MAX_ATTACHMENTS),
  async (req, res) => {
    try {
      const expense = await Expense.findById(req.params.id);
      if (!expense) {
        cleanupFiles(req.files);
        return res.status(404).json({ success: false, error: 'Expense not found' });
      }
      if (!ensureNotLocked(expense, res)) {
        cleanupFiles(req.files);
        return;
      }

      const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
      const expenseSchoolId = normalizeSchoolId(expense.schoolId);
      if (req.user.role !== 'super_admin' && requesterSchoolId !== expenseSchoolId) {
        cleanupFiles(req.files);
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      if ((expense.attachments?.length || 0) + (req.files?.length || 0) > MAX_ATTACHMENTS) {
        cleanupFiles(req.files);
        return res
          .status(400)
          .json({ success: false, error: `Max ${MAX_ATTACHMENTS} attachments per expense.` });
      }

      for (const f of req.files || []) {
        expense.attachments.push({
          filename: f.filename,
          originalName: f.originalname,
          mimeType: f.mimetype,
          size: f.size,
          storagePath: f.path,
          uploadedBy: req.user._id,
          isReceipt: true,
        });
      }
      appendEditHistory(expense, req.user, 'Attachments added', ['attachments']);
      await expense.save();
      await expense.populate(POPULATE);
      res.json({ success: true, data: toWire(expense) });
    } catch (err) {
      cleanupFiles(req.files);
      logger.error('Upload expense attachments error', { err: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * DELETE /api/expenses/:id/attachments/:attachmentId
 */
router.delete(
  '/:id/attachments/:attachmentId',
  protect,
  authorize(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const expense = await Expense.findById(req.params.id);
      if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
      if (!ensureNotLocked(expense, res)) return;

      const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
      const expenseSchoolId = normalizeSchoolId(expense.schoolId);
      if (req.user.role !== 'super_admin' && requesterSchoolId !== expenseSchoolId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      const attachment = expense.attachments.id(req.params.attachmentId);
      if (!attachment) {
        return res.status(404).json({ success: false, error: 'Attachment not found' });
      }
      const storagePath = attachment.storagePath;
      attachment.deleteOne();
      appendEditHistory(expense, req.user, 'Attachment removed', ['attachments']);
      await expense.save();

      // Best-effort filesystem cleanup; never fail the request on this.
      if (storagePath && fs.existsSync(storagePath)) {
        fs.unlink(storagePath, (err) => {
          if (err) logger.warn('Failed to unlink expense attachment', { err: err.message });
        });
      }

      await expense.populate(POPULATE);
      res.json({ success: true, data: toWire(expense) });
    } catch (err) {
      logger.error('Delete expense attachment error', { err: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/expenses/:id/attachments/:attachmentId/download
 *
 * Auth-gated streaming download. Receipts may contain PII so we do NOT
 * expose them via the public /uploads handler — every fetch goes through
 * this route, which checks role + school scope before streaming bytes.
 */
router.get(
  '/:id/attachments/:attachmentId/download',
  protect,
  authorize(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const expense = await Expense.findById(req.params.id);
      if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });

      const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
      const expenseSchoolId = normalizeSchoolId(expense.schoolId);
      if (req.user.role !== 'super_admin' && requesterSchoolId !== expenseSchoolId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      const attachment = expense.attachments.id(req.params.attachmentId);
      if (!attachment || !attachment.storagePath) {
        return res.status(404).json({ success: false, error: 'Attachment not found' });
      }

      // Defensive: confine resolved path to RECEIPTS_DIR (no path traversal).
      const resolved = path.resolve(attachment.storagePath);
      if (!resolved.startsWith(path.resolve(RECEIPTS_DIR))) {
        return res.status(400).json({ success: false, error: 'Invalid attachment path' });
      }
      if (!fs.existsSync(resolved)) {
        return res.status(404).json({ success: false, error: 'File missing on disk' });
      }

      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${(attachment.originalName || attachment.filename).replace(/"/g, '')}"`
      );
      res.setHeader('Cache-Control', 'private, no-store');
      fs.createReadStream(resolved).pipe(res);
    } catch (err) {
      logger.error('Download expense attachment error', { err: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/expenses/ocr
 *
 * Multipart upload of a single receipt. Saves the file under
 * uploads/expense-receipts/ and runs gpt-4o vision to extract structured
 * fields. Returns parsed data + the staged attachment metadata; the file
 * is later linked to an Expense when the admin clicks Save.
 *
 * If OCR fails for any reason, we still return the staged attachment so
 * manual entry is unblocked.
 */
router.post(
  '/ocr',
  protect,
  authorize(...ADMIN_ROLES),
  ocrLimiter,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const file = req.file;
    const stagedAttachment = {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storagePath: file.path, // sent back so /POST can attach it; never exposed in list/get
      isReceipt: true,
    };

    // PDFs aren't OCR'd in v1 — store, return empty parsed.
    if (/^application\/pdf$/i.test(file.mimetype)) {
      return res.json({
        success: true,
        data: {
          attachment: stagedAttachment,
          parsed: {},
          ocr: { processed: false, model: null, confidence: null },
          warning: 'PDF receipts are stored but not auto-scanned in this version.',
        },
      });
    }

    try {
      const result = await extractFromReceipt(file.path);
      if (!result.ok) {
        return res.json({
          success: true,
          data: {
            attachment: stagedAttachment,
            parsed: {},
            ocr: { processed: false, model: null, confidence: null },
            error: result.error,
          },
        });
      }

      // Convert cents (from sanitizer) back to wire major units for the form.
      const wireParsed = { ...result.parsed };
      if (wireParsed.subtotal !== null && wireParsed.subtotal !== undefined) {
        wireParsed.subtotal = centsToMajor(wireParsed.subtotal);
      }
      if (wireParsed.total !== null && wireParsed.total !== undefined) {
        wireParsed.total = centsToMajor(wireParsed.total);
      }
      if (Array.isArray(wireParsed.taxes)) {
        wireParsed.taxes = wireParsed.taxes.map((t) => ({
          ...t,
          amount: centsToMajor(t.amount),
        }));
      }
      if (Array.isArray(wireParsed.lineItems)) {
        wireParsed.lineItems = wireParsed.lineItems.map((li) => ({
          ...li,
          amount: centsToMajor(li.amount),
        }));
      }

      res.json({
        success: true,
        data: {
          attachment: stagedAttachment,
          parsed: wireParsed,
          ocr: {
            processed: true,
            processedAt: new Date(),
            model: result.model,
            confidence: wireParsed.confidence ?? null,
            rawText: result.rawText,
          },
        },
      });
    } catch (err) {
      logger.error('OCR endpoint error', { err: err.message });
      // We still keep the file so manual entry can proceed.
      res.json({
        success: true,
        data: {
          attachment: stagedAttachment,
          parsed: {},
          ocr: { processed: false, model: null, confidence: null },
          error: 'ocr_failed',
        },
      });
    }
  }
);

// ─── Utilities ─────────────────────────────────────────────────────────

function cleanupFiles(files) {
  if (!files) return;
  const arr = Array.isArray(files) ? files : [files];
  for (const f of arr) {
    if (f?.path && fs.existsSync(f.path)) {
      fs.unlink(f.path, () => {});
    }
  }
}

module.exports = router;
