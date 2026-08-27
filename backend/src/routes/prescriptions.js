const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Prescription = require('../models/Prescription');
const Medication = require('../models/Medication');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { processPrescriptionImage } = require('../utils/aiService');
const { createRemindersForMedication } = require('../utils/reminderScheduler');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Upload a prescription image; runs it through the AI service (OCR + NER + DDI)
router.post('/upload', auth, upload.single('prescription'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No prescription image provided' });
  }

  // Create the record first so nothing is lost even if the AI service is down
  const prescription = await Prescription.create({
    user: req.userId,
    imagePath: req.file.path,
    status: 'pending',
  });

  try {
    const user = await User.findById(req.userId);
    const aiResult = await processPrescriptionImage(req.file.path);

    if (!aiResult.success) {
      prescription.status = 'failed';
      await prescription.save();
      return res.status(502).json({ error: 'AI service could not process the image', prescription });
    }

    prescription.extractedText = aiResult.extracted_text || '';
    prescription.doctorInfo = aiResult.doctor_info || {};
    prescription.patientInfo = aiResult.patient_info || {};
    prescription.medications = (aiResult.medications || []).map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      instructions: m.instructions,
      times: [],
    }));
    prescription.interactions = aiResult.interactions || [];
    prescription.safetyInfo = aiResult.safety_info || {};
    prescription.confidence = aiResult.confidence || 0;
    prescription.status = 'processed';
    await prescription.save();

    res.status(201).json(prescription);
  } catch (err) {
    prescription.status = 'failed';
    await prescription.save();
    const timedOut = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
    res.status(502).json({
      error: timedOut
        ? 'AI processing took longer than expected. Please try again; the handwritten OCR service is still running.'
        : 'Could not reach the AI service. Is it running on AI_SERVICE_URL?',
      details: err.message,
      prescription,
    });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prescriptions', details: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ _id: req.params.id, user: req.userId });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    res.json(prescription);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prescription', details: err.message });
  }
});

// Confirm a processed prescription: turns its medications into real Medication
// records and generates upcoming Reminder records from each medication's times.
router.post('/:id/confirm', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ _id: req.params.id, user: req.userId });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (prescription.status !== 'processed') {
      return res.status(400).json({ error: `Prescription is '${prescription.status}', must be 'processed' to confirm` });
    }
    if (!Array.isArray(prescription.medications) || prescription.medications.length === 0) {
      return res.status(422).json({
        error: 'No medications were detected in this prescription. Upload a clearer image or add the medication manually.',
        prescription,
      });
    }

    const createdMedications = [];
    for (const med of prescription.medications) {
      const medication = await Medication.create({
        user: req.userId,
        prescription: prescription._id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        instructions: med.instructions,
        times: med.times && med.times.length ? med.times : [],
      });
      createdMedications.push(medication);
      await createRemindersForMedication(medication);
    }

    prescription.status = 'confirmed';
    await prescription.save();

    res.json({ prescription, medications: createdMedications, createdCount: createdMedications.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm prescription', details: err.message });
  }
});

// Update the schedule (times) for one medication within a prescription, then
// regenerate that medication's upcoming reminders to match.
router.post('/:id/medications/:medId/times', auth, async (req, res) => {
  try {
    const { times } = req.body;
    const prescription = await Prescription.findOne({ _id: req.params.id, user: req.userId });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

    const med = prescription.medications.id(req.params.medId);
    if (!med) return res.status(404).json({ error: 'Medication not found on this prescription' });

    med.times = times || [];
    await prescription.save();

    const linkedMedication = await Medication.findOne({ prescription: prescription._id, name: med.name });
    if (linkedMedication) {
      linkedMedication.times = times || [];
      await linkedMedication.save();
      await Reminder.deleteMany({ medication: linkedMedication._id, status: 'pending' });
      await createRemindersForMedication(linkedMedication);
    }

    res.json(prescription);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update times', details: err.message });
  }
});

module.exports = router;
