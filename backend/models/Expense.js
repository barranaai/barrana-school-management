/**
 * Expense
 *
 * School operational expense records (rent, salaries, supplies, utilities,
 * etc.). School-admin-only domain. Each record is school-scoped, auditable,
 * and can be locked for compliance.
 *
 * Money is stored as integer minor units (CAD cents) to avoid float drift.
 * The API exposes/accepts decimal major units; conversion happens at the
 * route layer via `centsToMajor` / `majorToCents`.
 *
 * Mirrors the auditing conventions used by IncidentReport:
 *   - append-only `editHistory`
 *   - `isLocked` rejects mutations at the route layer
 *   - per-school sequential `expenseNumber` (EXP-YYYY-NNNN)
 */

const mongoose = require('mongoose');

// ─── Canonical enums (single source of truth for routes/UI) ────────────
const CATEGORIES = [
  'salaries',
  'rent',
  'utilities',
  'supplies',
  'food',
  'transport',
  'maintenance',
  'software',
  'marketing',
  'training',
  'insurance',
  'taxes',
  'events',
  'fees',
  'other',
];

const PAYMENT_METHODS = [
  'cash',
  'card',
  'bank_transfer',
  'cheque',
  'e_transfer',
  'other',
];

const TAX_TYPES = ['GST', 'HST', 'PST', 'QST', 'OTHER'];

const STATUSES = ['recorded', 'void'];

// ─── Sub-schemas ───────────────────────────────────────────────────────

const taxSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TAX_TYPES, required: true },
    rate: { type: Number, min: 0, max: 1 }, // e.g. 0.05 for GST
    amount: { type: Number, required: true, min: 0 }, // CAD cents
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: String,
    mimeType: String,
    size: Number,
    /**
     * Internal storage path relative to backend/uploads. Receipts are NEVER
     * served from the public /uploads handler; access goes through
     * GET /api/expenses/:id/attachments/:attachmentId/download
     * which checks auth + school scope and streams the file.
     */
    storagePath: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isReceipt: { type: Boolean, default: true },
  },
  { _id: true }
);

const editHistorySchema = new mongoose.Schema(
  {
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    summary: { type: String, trim: true },
    fieldsChanged: { type: [String], default: [] },
  },
  { _id: false }
);

const ocrMetaSchema = new mongoose.Schema(
  {
    processed: { type: Boolean, default: false },
    processedAt: Date,
    model: String,
    confidence: { type: Number, min: 0, max: 1 },
    /**
     * Trimmed snapshot of the raw extraction so admins can audit what the
     * model actually returned vs. what they kept. Truncated at the route
     * layer to keep documents small.
     */
    rawText: String,
  },
  { _id: false }
);

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true },
    amount: { type: Number, min: 0 }, // CAD cents
  },
  { _id: false }
);

// ─── Main schema ───────────────────────────────────────────────────────

const expenseSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },

    /** Auto-generated EXP-YYYY-NNNN per school. */
    expenseNumber: { type: String, unique: true, index: true },

    // ─── When ────────────────────────────────────────────────────────
    incurredAt: { type: Date, required: true, index: true },
    recordedAt: { type: Date, default: Date.now },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ─── What ────────────────────────────────────────────────────────
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    subcategory: { type: String, trim: true, maxlength: 100 },
    vendorName: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    lineItems: { type: [lineItemSchema], default: [] },
    tags: { type: [String], default: [] },

    // ─── How much (all amounts in CAD cents) ─────────────────────────
    subtotal: { type: Number, required: true, min: 0 }, // cents
    taxes: { type: [taxSchema], default: [] },
    taxTotal: { type: Number, required: true, min: 0, default: 0 }, // cents
    total: { type: Number, required: true, min: 0 }, // cents
    currency: { type: String, default: 'CAD', uppercase: true, trim: true },

    // ─── How paid ────────────────────────────────────────────────────
    paymentMethod: { type: String, enum: PAYMENT_METHODS },
    paymentReference: { type: String, trim: true, maxlength: 200 },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,

    // ─── Receipts ────────────────────────────────────────────────────
    attachments: {
      type: [attachmentSchema],
      validate: {
        validator: (arr) => !Array.isArray(arr) || arr.length <= 10,
        message: 'An expense cannot have more than 10 attachments.',
      },
      default: [],
    },

    // ─── OCR metadata ────────────────────────────────────────────────
    ocr: { type: ocrMetaSchema, default: () => ({}) },

    // ─── Lifecycle ───────────────────────────────────────────────────
    status: {
      type: String,
      enum: STATUSES,
      default: 'recorded',
      index: true,
    },
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String, trim: true, maxlength: 500 },

    // ─── Compliance ──────────────────────────────────────────────────
    isLocked: { type: Boolean, default: false, index: true },
    lockedAt: Date,
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /** Append-only audit trail (mirrors IncidentReport). */
    editHistory: { type: [editHistorySchema], default: [] },
  },
  { timestamps: true }
);

// ─── Indexes for common dashboard / report queries ─────────────────────
expenseSchema.index({ schoolId: 1, incurredAt: -1 });
expenseSchema.index({ schoolId: 1, status: 1, incurredAt: -1 });
expenseSchema.index({ schoolId: 1, category: 1, incurredAt: -1 });
expenseSchema.index({ schoolId: 1, vendorName: 1 });

/**
 * Auto-generate a per-school sequential expense number on first save.
 * Format: EXP-{YEAR}-{4-digit-counter}, scoped to the school for the year.
 */
expenseSchema.pre('save', async function generateExpenseNumber(next) {
  if (this.expenseNumber) return next();
  try {
    const year = new Date(this.incurredAt || Date.now()).getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    const count = await this.constructor.countDocuments({
      schoolId: this.schoolId,
      createdAt: { $gte: yearStart, $lt: yearEnd },
    });
    const sequence = String(count + 1).padStart(4, '0');
    this.expenseNumber = `EXP-${year}-${sequence}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Recompute taxTotal from `taxes[]` and validate that
 * subtotal + taxTotal === total when both supplied. Defensive against
 * stale clients sending inconsistent numbers.
 */
expenseSchema.pre('save', function reconcileMoney(next) {
  const tt = (this.taxes || []).reduce(
    (sum, t) => sum + (Number.isFinite(t.amount) ? t.amount : 0),
    0
  );
  this.taxTotal = tt;

  // If client didn't supply total, derive it.
  if (!Number.isFinite(this.total) || this.total === 0) {
    this.total = (this.subtotal || 0) + tt;
  }

  // Allow up to 1¢ rounding tolerance between subtotal+taxTotal and total.
  const drift = Math.abs((this.subtotal || 0) + tt - this.total);
  if (drift > 1) {
    return next(
      new Error(
        `Money mismatch: subtotal (${this.subtotal}) + taxTotal (${tt}) ≠ total (${this.total}).`
      )
    );
  }
  return next();
});

// Expose enums for use in routes/validators/UI
expenseSchema.statics.CATEGORIES = CATEGORIES;
expenseSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
expenseSchema.statics.TAX_TYPES = TAX_TYPES;
expenseSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Expense', expenseSchema);
