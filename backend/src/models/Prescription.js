const mongoose = require('mongoose');

const prescriptionMedicationSchema = new mongoose.Schema(
  {
    name: String,
    dosage: String,
    frequency: String,
    instructions: String,
    times: [{ time: String, dosage: String }],
  },
  { _id: true }
);

const prescriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    imagePath: { type: String, required: true },
    extractedText: { type: String, default: '' },
    doctorInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    patientInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    medications: { type: [prescriptionMedicationSchema], default: [] },
    interactions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    safetyInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'processed', 'confirmed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Prescription', prescriptionSchema);
