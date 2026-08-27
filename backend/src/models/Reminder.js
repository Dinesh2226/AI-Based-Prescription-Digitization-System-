const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    medication: { type: mongoose.Schema.Types.ObjectId, ref: 'Medication', required: true },
    scheduledTime: { type: Date, required: true, index: true },
    dosage: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'taken', 'missed', 'snoozed'],
      default: 'pending',
    },
    takenAt: { type: Date, default: null },
    snoozeUntil: { type: Date, default: null },
    caregiverNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reminder', reminderSchema);
