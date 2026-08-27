const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema(
  {
    time: { type: String, required: true }, // "HH:MM" 24hr
    dosage: { type: String, default: '1 tablet' },
  },
  { _id: true }
);

const medicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },
    name: { type: String, required: true, trim: true },
    dosage: { type: String, default: 'As prescribed' },
    frequency: { type: String, default: 'once daily' },
    instructions: { type: String, default: '' },
    times: { type: [timeSlotSchema], default: [] },
    active: { type: Boolean, default: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Medication', medicationSchema);
