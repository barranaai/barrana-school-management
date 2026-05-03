/**
 * AvailabilitySlot
 *
 * A specific time window a teacher has published as available for
 * parent-teacher meetings. Atomic state machine so two parents can
 * never book the same slot:
 *
 *   published  →  booked      (parent reservation succeeds)
 *   published  →  cancelled   (teacher removes the slot)
 *   booked     →  published   (meeting cancelled, slot freed)
 *
 * The atomic transition is enforced at the route level via
 * `findOneAndUpdate` with a status filter.
 */

const mongoose = require('mongoose');

const SLOT_STATUS = ['published', 'booked', 'cancelled'];

const availabilitySlotSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 240 },

    /** Free-text location (e.g. "Classroom 2A") — optional. */
    location: { type: String, trim: true, maxlength: 200 },

    /**
     * If the meeting is virtual, the URL the parent should join.
     * MVP allows manual entry; auto-creation is Push 2.
     */
    meetingUrl: { type: String, trim: true, maxlength: 500 },

    /** Format hint for the UI: in_person, virtual, phone. */
    format: {
      type: String,
      enum: ['in_person', 'virtual', 'phone'],
      default: 'in_person',
    },

    notes: { type: String, trim: true, maxlength: 1000 },

    status: {
      type: String,
      enum: SLOT_STATUS,
      default: 'published',
      index: true,
    },

    /** Set when status === 'booked'. */
    meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  },
  { timestamps: true }
);

// Common dashboard queries
availabilitySlotSchema.index({ schoolId: 1, startsAt: 1, status: 1 });
availabilitySlotSchema.index({ teacherId: 1, startsAt: 1, status: 1 });

availabilitySlotSchema.pre('save', function setDuration(next) {
  if (this.startsAt && this.endsAt) {
    const minutes = Math.round((this.endsAt - this.startsAt) / 60000);
    if (Number.isFinite(minutes) && minutes > 0) this.durationMinutes = minutes;
  }
  next();
});

availabilitySlotSchema.statics.SLOT_STATUS = SLOT_STATUS;

module.exports = mongoose.model('AvailabilitySlot', availabilitySlotSchema);
