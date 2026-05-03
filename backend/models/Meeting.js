/**
 * Meeting
 *
 * A booked parent-teacher meeting. Owns its own time window (denormalized
 * from the slot for fast queries) and tracks lifecycle, reminders, and
 * audit fields.
 *
 * State machine:
 *   confirmed   →  cancelled   (either side, ≥1h before startsAt)
 *   confirmed   →  rescheduled (links to a new meeting via nextMeetingId)
 *   confirmed   →  completed   (teacher marks done after meeting)
 *   confirmed   →  no_show     (teacher marks no-show after meeting)
 *
 * `meetingNumber` is auto-generated as MTG-{YEAR}-{4-digit-counter}
 * scoped to school+year. Same pattern as IncidentReport.
 */

const mongoose = require('mongoose');

const MEETING_STATUS = ['confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled'];

const reminderSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['24h', '1h'], required: true },
    sentAt: { type: Date, default: Date.now },
    deliveryStatus: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped'],
      default: 'sent',
    },
    deliveryError: { type: String, trim: true },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    meetingNumber: {
      type: String,
      unique: true,
      index: true,
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AvailabilitySlot',
      required: true,
    },

    /** Denormalized for filter performance. */
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },

    /** Snapshotted from the slot at booking time. */
    location: { type: String, trim: true, maxlength: 200 },
    meetingUrl: { type: String, trim: true, maxlength: 500 },
    format: {
      type: String,
      enum: ['in_person', 'virtual', 'phone'],
      default: 'in_person',
    },

    /** Optional message from the parent at booking. */
    bookingMessage: { type: String, trim: true, maxlength: 1000 },

    /** Optional teacher notes recorded after the meeting. */
    teacherNotes: { type: String, trim: true, maxlength: 4000 },

    status: {
      type: String,
      enum: MEETING_STATUS,
      default: 'confirmed',
      index: true,
    },

    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },

    completedAt: { type: Date },
    noShowAt: { type: Date },
    noShowReportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /** If this meeting was rescheduled to a new one, link it. */
    rescheduledToMeetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
    /** If this meeting is the result of rescheduling another, link back. */
    rescheduledFromMeetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },

    reminderHistory: { type: [reminderSchema], default: [] },
  },
  { timestamps: true }
);

// Compound indexes for the most common dashboard queries
meetingSchema.index({ schoolId: 1, startsAt: 1 });
meetingSchema.index({ teacherId: 1, startsAt: 1, status: 1 });
meetingSchema.index({ parentId: 1, startsAt: 1, status: 1 });

meetingSchema.pre('save', async function generateMeetingNumber(next) {
  if (this.meetingNumber) return next();
  try {
    const year = new Date(this.startsAt || Date.now()).getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    const count = await this.constructor.countDocuments({
      schoolId: this.schoolId,
      createdAt: { $gte: yearStart, $lt: yearEnd },
    });
    const sequence = String(count + 1).padStart(4, '0');
    this.meetingNumber = `MTG-${year}-${sequence}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

meetingSchema.statics.MEETING_STATUS = MEETING_STATUS;

module.exports = mongoose.model('Meeting', meetingSchema);
