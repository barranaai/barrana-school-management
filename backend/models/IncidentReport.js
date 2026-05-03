/**
 * IncidentReport
 *
 * Event-driven incident records (injuries, behavior, illness, allergic
 * reactions, medication errors, etc.). Distinct from scheduled progress
 * reports because incidents:
 *   - happen ad-hoc, not on a schedule
 *   - require IMMEDIATE parent notification (legal in many jurisdictions)
 *   - need structured compliance fields (severity, body part, first aid)
 *   - can involve multiple students at once
 *   - can be locked for compliance once parents acknowledge
 *
 * Audit trail is mandatory: every edit is appended to `editHistory` and
 * locked records reject further mutations at the route level.
 */

const mongoose = require('mongoose');

const INCIDENT_TYPES = [
  'injury',
  'behavior',
  'illness',
  'allergic_reaction',
  'medication_error',
  'environmental',
  'lost_child',
  'property_damage',
  'other',
];

const SEVERITY_LEVELS = ['minor', 'moderate', 'serious', 'critical'];

const STATUS_FLOW = [
  'reported',         // initial state
  'parent_notified',  // notification dispatched
  'acknowledged',     // parent acknowledged at least one notification
  'under_review',     // admin actively reviewing
  'resolved',         // resolution recorded
  'closed',           // closed out (terminal — usually after lock)
];

const NOTIFICATION_METHODS = ['email', 'sms', 'whatsapp', 'push', 'phone', 'in_person'];

const injurySchema = new mongoose.Schema(
  {
    bodyPart: { type: String, trim: true },
    injuryType: { type: String, trim: true }, // bruise, scrape, cut, bump, etc.
    severity: { type: String, enum: SEVERITY_LEVELS },
    notes: { type: String, trim: true },
  },
  { _id: true }
);

const studentInvolvedSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['affected', 'involved', 'witness'],
      default: 'affected',
    },
    injuries: { type: [injurySchema], default: [] },
    notes: { type: String, trim: true },
  },
  { _id: true }
);

const witnessSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['staff', 'student', 'parent', 'visitor', 'other'],
      default: 'staff',
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, trim: true }, // for non-system witnesses
    statement: { type: String, trim: true },
  },
  { _id: true }
);

const parentNotificationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    parentEmail: { type: String, trim: true },
    notifiedAt: { type: Date, default: Date.now },
    method: { type: String, enum: NOTIFICATION_METHODS, required: true },
    notifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deliveryStatus: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped'],
      default: 'queued',
    },
    deliveryError: { type: String, trim: true },
    acknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date },
    acknowledgmentNotes: { type: String, trim: true },
  },
  { _id: true, timestamps: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const editHistorySchema = new mongoose.Schema(
  {
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    summary: { type: String, trim: true }, // short human-readable summary
    fieldsChanged: { type: [String], default: [] },
  },
  { _id: false }
);

const incidentReportSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    /** Human-readable identifier, auto-generated on save (e.g. INC-2026-0042). */
    reportNumber: {
      type: String,
      unique: true,
      index: true,
    },

    // ─── When ───────────────────────────────────────────────────────
    occurredAt: { type: Date, required: true },
    reportedAt: { type: Date, default: Date.now },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: { type: String, trim: true },

    // ─── What ───────────────────────────────────────────────────────
    incidentType: {
      type: String,
      enum: INCIDENT_TYPES,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: SEVERITY_LEVELS,
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true },

    // ─── Who ────────────────────────────────────────────────────────
    studentsInvolved: {
      type: [studentInvolvedSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one student must be marked as involved.',
      },
    },
    witnesses: { type: [witnessSchema], default: [] },

    // ─── Response ───────────────────────────────────────────────────
    immediateAction: { type: String, trim: true },
    firstAidGiven: { type: Boolean, default: false },
    firstAidDetails: { type: String, trim: true },
    emergencyServicesCalled: { type: Boolean, default: false },
    emergencyServicesDetails: { type: String, trim: true },

    // ─── Media ──────────────────────────────────────────────────────
    attachments: {
      type: [attachmentSchema],
      validate: {
        validator: (arr) => !Array.isArray(arr) || arr.length <= 10,
        message: 'An incident cannot have more than 10 media attachments.',
      },
      default: [],
    },

    // ─── Parent Notification ────────────────────────────────────────
    parentNotifications: { type: [parentNotificationSchema], default: [] },

    // ─── Lifecycle ──────────────────────────────────────────────────
    status: {
      type: String,
      enum: STATUS_FLOW,
      default: 'reported',
      index: true,
    },
    followUpRequired: { type: Boolean, default: false },
    followUpActions: { type: String, trim: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: { type: String, trim: true },

    // ─── Admin Review ──────────────────────────────────────────────
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true },

    // ─── Compliance ─────────────────────────────────────────────────
    /** Once locked, mutations are rejected at the route level. */
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /** Append-only audit trail. */
    editHistory: { type: [editHistorySchema], default: [] },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for the most common dashboard queries
incidentReportSchema.index({ schoolId: 1, occurredAt: -1 });
incidentReportSchema.index({ schoolId: 1, status: 1, occurredAt: -1 });
incidentReportSchema.index({ schoolId: 1, severity: 1, occurredAt: -1 });
incidentReportSchema.index({ 'studentsInvolved.studentId': 1, occurredAt: -1 });

/**
 * Auto-generate a per-school sequential report number on first save.
 * Format: INC-{YEAR}-{4-digit-counter} scoped to the school for the year.
 */
incidentReportSchema.pre('save', async function generateReportNumber(next) {
  if (this.reportNumber) return next();
  try {
    const year = new Date(this.occurredAt || Date.now()).getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    // Use the model itself (this.constructor) to count existing
    // incidents for the same school+year to derive the next number.
    const count = await this.constructor.countDocuments({
      schoolId: this.schoolId,
      createdAt: { $gte: yearStart, $lt: yearEnd },
    });
    const sequence = String(count + 1).padStart(4, '0');
    this.reportNumber = `INC-${year}-${sequence}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

// Expose enums for use in routes/validators
incidentReportSchema.statics.INCIDENT_TYPES = INCIDENT_TYPES;
incidentReportSchema.statics.SEVERITY_LEVELS = SEVERITY_LEVELS;
incidentReportSchema.statics.STATUS_FLOW = STATUS_FLOW;
incidentReportSchema.statics.NOTIFICATION_METHODS = NOTIFICATION_METHODS;

module.exports = mongoose.model('IncidentReport', incidentReportSchema);
