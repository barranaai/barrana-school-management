/**
 * /api/incidents — Incident Reporting routes
 *
 * Event-driven incident records with role-based access:
 *   - teacher        : create + list/edit own + upload media
 *   - school_admin   : full visibility within school + review/resolve/lock
 *   - super_admin    : cross-school visibility
 *   - parent         : view incidents involving their children + acknowledge
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const IncidentReport = require('../models/IncidentReport');
const User = require('../models/User');
const firebaseService = require('../services/firebaseService');
const loggerUtils = require('../utils/logger');
const logger = loggerUtils.logger;

const MAX_INCIDENT_ATTACHMENTS = 10;
const INCIDENT_MEDIA_DIR = path.join(__dirname, '..', 'uploads', 'incident-media');

// ─── Multer disk storage for incident photos ─────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(INCIDENT_MEDIA_DIR, { recursive: true });
      cb(null, INCIDENT_MEDIA_DIR);
    } catch (err) {
      cb(null, '/tmp');
    }
  },
  filename: (req, file, cb) => {
    const incidentId = req.params.id || 'tmp';
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ts = Date.now();
    const rand = Math.round(Math.random() * 1e6);
    cb(null, `incident-${incidentId}-${ts}-${rand}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /^(image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|quicktime|webm))$/i;
  if (allowed.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only images (jpeg/png/gif/webp) and videos (mp4/mov/webm) are allowed.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: MAX_INCIDENT_ATTACHMENTS },
});

// ─── Helpers ──────────────────────────────────────────────────────────

/** Convert any schoolId reference (string or populated) to a string. */
function normalizeSchoolId(schoolId) {
  if (!schoolId) return null;
  if (typeof schoolId === 'string') return schoolId;
  if (schoolId._id) return schoolId._id.toString();
  return schoolId.toString();
}

/**
 * Build a Mongo query that scopes incidents to what the requester is
 * allowed to see. Centralized to avoid drift between handlers.
 */
function scopeQueryToUser(user) {
  const requesterSchoolId = normalizeSchoolId(user.schoolId);
  switch (user.role) {
    case 'super_admin':
      return {}; // unrestricted
    case 'school_admin':
      return { schoolId: requesterSchoolId };
    case 'teacher':
      return { schoolId: requesterSchoolId, reportedBy: user._id };
    case 'parent':
      // Parents see incidents involving any of their children. Resolved
      // by `parentEmail` since that's how students are linked to parents.
      return {
        schoolId: requesterSchoolId,
        'studentsInvolved.studentId': { $exists: true },
      };
    default:
      // Defensive — students should never reach this route, but be safe.
      return { _id: null };
  }
}

/** Filter parent's incidents down to only those involving their children. */
async function filterParentVisible(incidents, parentUser) {
  const parentEmail = (parentUser.email || '').toLowerCase();
  if (!parentEmail) return [];
  const children = await User.find({
    role: 'student',
    parentEmail,
  })
    .select('_id')
    .lean();
  const childIds = new Set(children.map((c) => c._id.toString()));
  return incidents.filter((inc) =>
    (inc.studentsInvolved || []).some((s) =>
      childIds.has((s.studentId?._id || s.studentId)?.toString())
    )
  );
}

/** Append an entry to the audit trail. */
function appendEditHistory(incident, user, summary, fieldsChanged = []) {
  incident.editHistory.push({
    editedAt: new Date(),
    editedBy: user._id,
    summary,
    fieldsChanged,
  });
}

/** Reject mutations on locked incidents (admin can still unlock). */
function ensureNotLocked(incident, res) {
  if (incident.isLocked) {
    res.status(423).json({
      success: false,
      error: 'incident_locked',
      message: 'This incident is locked for compliance and cannot be modified. Unlock it first.',
    });
    return false;
  }
  return true;
}

const POPULATE = [
  { path: 'reportedBy', select: 'firstName lastName email role' },
  { path: 'studentsInvolved.studentId', select: 'firstName lastName studentGrade studentClass parentEmail' },
  { path: 'witnesses.userId', select: 'firstName lastName role' },
  { path: 'parentNotifications.notifiedBy', select: 'firstName lastName' },
  { path: 'reviewedBy', select: 'firstName lastName' },
  { path: 'resolvedBy', select: 'firstName lastName' },
  { path: 'lockedBy', select: 'firstName lastName' },
  { path: 'editHistory.editedBy', select: 'firstName lastName' },
];

// ─── Routes ───────────────────────────────────────────────────────────

/**
 * GET /api/incidents/enums
 * Returns the canonical enums (types, severities, statuses, methods)
 * so clients can render dropdowns from a single source of truth.
 */
router.get('/enums', protect, (_req, res) => {
  res.json({
    success: true,
    data: {
      incidentTypes: IncidentReport.INCIDENT_TYPES,
      severities: IncidentReport.SEVERITY_LEVELS,
      statuses: IncidentReport.STATUS_FLOW,
      notificationMethods: IncidentReport.NOTIFICATION_METHODS,
    },
  });
});

/**
 * GET /api/incidents/stats
 * Aggregated counts for the admin dashboard. Scoped by role.
 */
router.get(
  '/stats',
  protect,
  authorize('school_admin', 'super_admin', 'teacher'),
  async (req, res) => {
    try {
      const baseQuery = scopeQueryToUser(req.user);
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const last30 = { ...baseQuery, occurredAt: { $gte: since } };

      const [total, last30Total, bySeverity, byType, byStatus] = await Promise.all([
        IncidentReport.countDocuments(baseQuery),
        IncidentReport.countDocuments(last30),
        IncidentReport.aggregate([
          { $match: { ...baseQuery, occurredAt: { $gte: since } } },
          { $group: { _id: '$severity', count: { $sum: 1 } } },
        ]),
        IncidentReport.aggregate([
          { $match: { ...baseQuery, occurredAt: { $gte: since } } },
          { $group: { _id: '$incidentType', count: { $sum: 1 } } },
        ]),
        IncidentReport.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
      ]);

      const toMap = (arr) =>
        arr.reduce((acc, x) => ({ ...acc, [x._id]: x.count }), {});

      res.json({
        success: true,
        data: {
          total,
          last30Days: last30Total,
          severityLast30: toMap(bySeverity),
          typeLast30: toMap(byType),
          byStatus: toMap(byStatus),
        },
      });
    } catch (err) {
      logger.error('Incident stats error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/incidents
 * List incidents the requester is allowed to see, with optional filters.
 * Query params: ?severity, ?status, ?incidentType, ?from, ?to, ?studentId, ?limit, ?skip
 */
router.get('/', protect, async (req, res) => {
  try {
    if (!['teacher', 'school_admin', 'super_admin', 'parent'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const query = scopeQueryToUser(req.user);
    if (req.query.severity) query.severity = req.query.severity;
    if (req.query.status) query.status = req.query.status;
    if (req.query.incidentType) query.incidentType = req.query.incidentType;
    if (req.query.studentId) query['studentsInvolved.studentId'] = req.query.studentId;
    if (req.query.from || req.query.to) {
      query.occurredAt = {};
      if (req.query.from) query.occurredAt.$gte = new Date(req.query.from);
      if (req.query.to) query.occurredAt.$lte = new Date(req.query.to);
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = parseInt(req.query.skip, 10) || 0;

    let docs = await IncidentReport.find(query)
      .populate(POPULATE)
      .sort({ occurredAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (req.user.role === 'parent') {
      docs = await filterParentVisible(docs, req.user);
    }

    res.json({ success: true, data: docs, count: docs.length });
  } catch (err) {
    logger.error('List incidents error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/incidents/:id
 * Get a single incident if the requester is allowed to see it.
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const incident = await IncidentReport.findById(req.params.id).populate(POPULATE);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }

    const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
    const incidentSchoolId = normalizeSchoolId(incident.schoolId);

    if (req.user.role !== 'super_admin' && requesterSchoolId !== incidentSchoolId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (req.user.role === 'teacher' && incident.reportedBy?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Teachers can only view incidents they reported.' });
    }

    if (req.user.role === 'parent') {
      const parentEmail = (req.user.email || '').toLowerCase();
      const involvedStudentIds = (incident.studentsInvolved || []).map((s) =>
        (s.studentId?._id || s.studentId)?.toString()
      );
      const childMatch = await User.findOne({
        role: 'student',
        parentEmail,
        _id: { $in: involvedStudentIds },
      }).select('_id');
      if (!childMatch) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
    }

    res.json({ success: true, data: incident });
  } catch (err) {
    logger.error('Get incident error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/incidents
 * Create a new incident. Teachers, school admins, and super admins.
 */
router.post(
  '/',
  protect,
  authorize('teacher', 'school_admin', 'super_admin'),
  [
    body('occurredAt').isISO8601().withMessage('occurredAt must be ISO 8601'),
    body('incidentType').isIn(IncidentReport.INCIDENT_TYPES).withMessage('Invalid incident type'),
    body('severity').isIn(IncidentReport.SEVERITY_LEVELS).withMessage('Invalid severity'),
    body('description').trim().isLength({ min: 5, max: 5000 }).withMessage('Description must be 5–5000 chars'),
    body('studentsInvolved').isArray({ min: 1 }).withMessage('At least one student must be involved'),
    body('location').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
    body('immediateAction').optional({ checkFalsy: true }).trim(),
    body('firstAidGiven').optional().isBoolean(),
    body('firstAidDetails').optional({ checkFalsy: true }).trim(),
    body('emergencyServicesCalled').optional().isBoolean(),
    body('emergencyServicesDetails').optional({ checkFalsy: true }).trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'Validation failed', errors: errors.array() });
      }

      const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
      if (!requesterSchoolId) {
        return res.status(400).json({ success: false, error: 'No school context found for requester.' });
      }

      const incident = new IncidentReport({
        ...req.body,
        schoolId: requesterSchoolId,
        reportedBy: req.user._id,
        reportedAt: new Date(),
      });
      appendEditHistory(incident, req.user, 'Incident created');
      await incident.save();
      await incident.populate(POPULATE);

      // Real-time + persistent notify school admins of the new incident.
      try {
        const admins = await User.find({
          role: { $in: ['school_admin', 'super_admin'] },
          schoolId: requesterSchoolId,
          isActive: { $ne: false },
        });
        const reporterName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
        const studentCount = incident.studentsInvolved?.length || 0;

        for (const admin of admins) {
          admin.notifications = admin.notifications || [];
          admin.notifications.push({
            id: `incident_${incident._id}_${Date.now()}`,
            type: 'alert',
            title: `New ${incident.severity} incident reported`,
            message: `${reporterName} reported a ${incident.severity} ${incident.incidentType.replace(/_/g, ' ')} incident involving ${studentCount} student(s).`,
            data: {
              incidentId: incident._id.toString(),
              severity: incident.severity,
              incidentType: incident.incidentType,
              reportNumber: incident.reportNumber,
            },
            isRead: false,
            createdAt: new Date(),
          });
          await admin.save();

          if (firebaseService.isFirebaseInitialized?.() && admin.fcmTokens?.length) {
            try {
              await firebaseService.sendNotificationToUser(
                admin,
                {
                  title: `🚨 ${incident.severity.toUpperCase()} incident reported`,
                  body: `${reporterName} reported a ${incident.incidentType.replace(/_/g, ' ')}. ${incident.reportNumber}.`,
                  type: 'incident',
                  priority: 'high',
                },
                {
                  incidentId: incident._id.toString(),
                  reportNumber: incident.reportNumber,
                }
              );
            } catch (fcmErr) {
              logger.warn('FCM notify admin failed:', fcmErr.message);
            }
          }
        }
      } catch (notifyErr) {
        logger.error('Admin notify on incident create failed:', notifyErr);
      }

      res.status(201).json({ success: true, data: incident });
    } catch (err) {
      logger.error('Create incident error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * PUT /api/incidents/:id
 * Update an incident (rejected if locked).
 */
router.put(
  '/:id',
  protect,
  authorize('teacher', 'school_admin', 'super_admin'),
  async (req, res) => {
    try {
      const incident = await IncidentReport.findById(req.params.id);
      if (!incident) {
        return res.status(404).json({ success: false, error: 'Incident not found' });
      }
      if (!ensureNotLocked(incident, res)) return;

      const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
      const incidentSchoolId = normalizeSchoolId(incident.schoolId);
      if (req.user.role !== 'super_admin' && requesterSchoolId !== incidentSchoolId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      if (req.user.role === 'teacher' && incident.reportedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Teachers can only edit incidents they reported.' });
      }

      // Whitelist of mutable fields to prevent privileged field tampering.
      const ALLOWED = [
        'occurredAt', 'location', 'incidentType', 'severity', 'description',
        'studentsInvolved', 'witnesses',
        'immediateAction', 'firstAidGiven', 'firstAidDetails',
        'emergencyServicesCalled', 'emergencyServicesDetails',
        'followUpRequired', 'followUpActions',
      ];
      const fieldsChanged = [];
      for (const key of ALLOWED) {
        if (key in req.body) {
          incident[key] = req.body[key];
          fieldsChanged.push(key);
        }
      }
      appendEditHistory(incident, req.user, 'Incident updated', fieldsChanged);
      await incident.save();
      await incident.populate(POPULATE);
      res.json({ success: true, data: incident });
    } catch (err) {
      logger.error('Update incident error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/incidents/:id/notify-parents
 * Dispatches an in-app notification (and FCM push if available) to each
 * affected child's parent. Email/SMS/WhatsApp can be wired later via the
 * `methods` body field; for now, in-app + push are the always-on path.
 *
 * Body: { methods?: string[], note?: string }
 */
router.post(
  '/:id/notify-parents',
  protect,
  authorize('teacher', 'school_admin', 'super_admin'),
  async (req, res) => {
    try {
      const incident = await IncidentReport.findById(req.params.id).populate(POPULATE);
      if (!incident) {
        return res.status(404).json({ success: false, error: 'Incident not found' });
      }
      if (!ensureNotLocked(incident, res)) return;

      const methods = Array.isArray(req.body.methods) && req.body.methods.length > 0
        ? req.body.methods
        : ['push'];

      const dispatched = [];
      for (const sv of incident.studentsInvolved) {
        const student = sv.studentId; // populated
        if (!student?.parentEmail) continue;
        const parent = await User.findOne({
          role: 'parent',
          email: student.parentEmail.toLowerCase(),
        });
        if (!parent) continue;

        // Persist in-app notification.
        parent.notifications = parent.notifications || [];
        parent.notifications.push({
          id: `incident_${incident._id}_${Date.now()}`,
          type: 'alert',
          title: `Incident report — ${student.firstName} ${student.lastName}`,
          message: `An incident report has been filed (${incident.reportNumber}). Please review and acknowledge.`,
          data: {
            incidentId: incident._id.toString(),
            reportNumber: incident.reportNumber,
            severity: incident.severity,
            incidentType: incident.incidentType,
          },
          isRead: false,
          createdAt: new Date(),
        });
        await parent.save();

        // Record a notification entry on the incident itself (per method).
        for (const method of methods) {
          let deliveryStatus = 'queued';
          let deliveryError;
          try {
            if (method === 'push') {
              if (firebaseService.isFirebaseInitialized?.() && parent.fcmTokens?.length) {
                await firebaseService.sendNotificationToUser(
                  parent,
                  {
                    title: `🚨 Incident report for ${student.firstName}`,
                    body: `${incident.severity.toUpperCase()} ${incident.incidentType.replace(/_/g, ' ')} — ${incident.reportNumber}. Please open and acknowledge.`,
                    type: 'incident',
                    priority: 'high',
                  },
                  { incidentId: incident._id.toString(), reportNumber: incident.reportNumber }
                );
                deliveryStatus = 'sent';
              } else {
                deliveryStatus = 'skipped';
                deliveryError = 'No FCM tokens for parent';
              }
            } else {
              // email / sms / whatsapp / phone / in_person — record the
              // intent so admins can see what was promised, even if the
              // actual channel integration is wired later.
              deliveryStatus = 'queued';
            }
          } catch (sendErr) {
            deliveryStatus = 'failed';
            deliveryError = sendErr.message;
          }

          incident.parentNotifications.push({
            studentId: student._id,
            parentEmail: student.parentEmail,
            method,
            notifiedBy: req.user._id,
            notifiedAt: new Date(),
            deliveryStatus,
            deliveryError,
          });
          dispatched.push({ studentId: student._id, method, deliveryStatus, deliveryError });
        }
      }

      if (incident.status === 'reported') incident.status = 'parent_notified';
      appendEditHistory(incident, req.user, `Parents notified via ${methods.join(', ')}`, ['parentNotifications', 'status']);
      await incident.save();
      await incident.populate(POPULATE);

      res.json({ success: true, data: incident, dispatched });
    } catch (err) {
      logger.error('Notify parents error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/incidents/:id/acknowledge
 * Parent acknowledges the incident. Marks all notifications for any of
 * their children as acknowledged.
 */
router.post('/:id/acknowledge', protect, authorize('parent'), async (req, res) => {
  try {
    const incident = await IncidentReport.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }
    const parentEmail = (req.user.email || '').toLowerCase();
    let touched = false;
    incident.parentNotifications.forEach((n) => {
      if ((n.parentEmail || '').toLowerCase() === parentEmail && !n.acknowledged) {
        n.acknowledged = true;
        n.acknowledgedAt = new Date();
        n.acknowledgmentNotes = req.body.notes;
        touched = true;
      }
    });
    if (!touched) {
      return res.status(400).json({ success: false, error: 'No pending notifications to acknowledge for this parent.' });
    }
    if (incident.status === 'parent_notified') incident.status = 'acknowledged';
    appendEditHistory(incident, req.user, 'Parent acknowledged');
    await incident.save();
    await incident.populate(POPULATE);
    res.json({ success: true, data: incident });
  } catch (err) {
    logger.error('Acknowledge incident error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/incidents/:id/resolve
 * Mark an incident as resolved.
 */
router.post(
  '/:id/resolve',
  protect,
  authorize('school_admin', 'super_admin', 'teacher'),
  async (req, res) => {
    try {
      const incident = await IncidentReport.findById(req.params.id);
      if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });
      if (!ensureNotLocked(incident, res)) return;

      incident.status = 'resolved';
      incident.resolvedAt = new Date();
      incident.resolvedBy = req.user._id;
      if (req.body.resolutionNotes) incident.resolutionNotes = req.body.resolutionNotes;
      appendEditHistory(incident, req.user, 'Incident resolved', ['status', 'resolvedAt', 'resolutionNotes']);
      await incident.save();
      await incident.populate(POPULATE);
      res.json({ success: true, data: incident });
    } catch (err) {
      logger.error('Resolve incident error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/incidents/:id/review
 * Admin records a review (review notes + sets reviewedBy/reviewedAt).
 */
router.post(
  '/:id/review',
  protect,
  authorize('school_admin', 'super_admin'),
  async (req, res) => {
    try {
      const incident = await IncidentReport.findById(req.params.id);
      if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });
      if (!ensureNotLocked(incident, res)) return;

      incident.reviewedBy = req.user._id;
      incident.reviewedAt = new Date();
      if (req.body.reviewNotes) incident.reviewNotes = req.body.reviewNotes;
      if (incident.status === 'reported' || incident.status === 'parent_notified' || incident.status === 'acknowledged') {
        incident.status = 'under_review';
      }
      appendEditHistory(incident, req.user, 'Incident reviewed', ['reviewedBy', 'reviewedAt', 'reviewNotes']);
      await incident.save();
      await incident.populate(POPULATE);
      res.json({ success: true, data: incident });
    } catch (err) {
      logger.error('Review incident error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/incidents/:id/lock
 * Compliance lock — once locked no edits allowed (until unlocked by admin).
 * Body: { lock: boolean }   — lock=true to lock, lock=false to unlock.
 */
router.post(
  '/:id/lock',
  protect,
  authorize('school_admin', 'super_admin'),
  async (req, res) => {
    try {
      const incident = await IncidentReport.findById(req.params.id);
      if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });
      const lock = req.body.lock !== false;
      incident.isLocked = lock;
      incident.lockedAt = lock ? new Date() : undefined;
      incident.lockedBy = lock ? req.user._id : undefined;
      if (lock && incident.status !== 'resolved') incident.status = 'closed';
      appendEditHistory(incident, req.user, lock ? 'Incident locked' : 'Incident unlocked', ['isLocked']);
      await incident.save();
      await incident.populate(POPULATE);
      res.json({ success: true, data: incident });
    } catch (err) {
      logger.error('Lock incident error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * POST /api/incidents/:id/media
 * Upload incident photos/videos (max 10 total combined).
 */
router.post(
  '/:id/media',
  protect,
  authorize('teacher', 'school_admin', 'super_admin'),
  upload.array('media', MAX_INCIDENT_ATTACHMENTS),
  async (req, res) => {
    try {
      const incident = await IncidentReport.findById(req.params.id);
      if (!incident) {
        // Clean up uploaded files since we're rejecting.
        for (const f of req.files || []) {
          try { fs.existsSync(f.path) && fs.unlinkSync(f.path); } catch { /* noop */ }
        }
        return res.status(404).json({ success: false, error: 'Incident not found' });
      }
      if (!ensureNotLocked(incident, res)) {
        for (const f of req.files || []) {
          try { fs.existsSync(f.path) && fs.unlinkSync(f.path); } catch { /* noop */ }
        }
        return;
      }

      const currentCount = incident.attachments?.length || 0;
      const incomingCount = (req.files || []).length;
      if (currentCount + incomingCount > MAX_INCIDENT_ATTACHMENTS) {
        for (const f of req.files || []) {
          try { fs.existsSync(f.path) && fs.unlinkSync(f.path); } catch { /* noop */ }
        }
        return res.status(400).json({
          success: false,
          message: `An incident cannot have more than ${MAX_INCIDENT_ATTACHMENTS} media attachments. ${currentCount} present; ${incomingCount} would exceed.`,
        });
      }

      for (const f of req.files || []) {
        incident.attachments.push({
          filename: f.filename,
          originalName: f.originalname,
          mimeType: f.mimetype,
          size: f.size,
          url: `/uploads/incident-media/${f.filename}`,
          uploadedAt: new Date(),
          uploadedBy: req.user._id,
        });
      }
      appendEditHistory(incident, req.user, `Uploaded ${incomingCount} media file(s)`, ['attachments']);
      await incident.save();
      await incident.populate(POPULATE);
      res.json({ success: true, data: incident });
    } catch (err) {
      logger.error('Upload incident media error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * DELETE /api/incidents/:id
 * Soft-style delete: only school_admin/super_admin and only if NOT locked.
 * In a future revision we may switch to a deletedAt soft-delete column;
 * for now we hard-delete so dashboards don't accumulate cruft during dev.
 */
router.delete(
  '/:id',
  protect,
  authorize('school_admin', 'super_admin'),
  async (req, res) => {
    try {
      const incident = await IncidentReport.findById(req.params.id);
      if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });
      if (incident.isLocked) {
        return res.status(423).json({
          success: false,
          error: 'incident_locked',
          message: 'Locked incidents cannot be deleted. Unlock first if removal is required.',
        });
      }
      await incident.deleteOne();
      res.json({ success: true });
    } catch (err) {
      logger.error('Delete incident error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
