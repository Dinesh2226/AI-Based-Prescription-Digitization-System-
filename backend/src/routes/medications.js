const express = require('express');
const auth = require('../middleware/auth');
const Medication = require('../models/Medication');
const Reminder = require('../models/Reminder');
const { createRemindersForMedication } = require('../utils/reminderScheduler');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { active } = req.query;
    const filter = { user: req.userId };
    if (active !== undefined) filter.active = active === 'true';

    const medications = await Medication.find(filter).sort({ createdAt: -1 });
    res.json(medications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch medications', details: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, dosage, frequency, instructions, times } = req.body;
    if (!name) return res.status(400).json({ error: 'Medication name is required' });

    const medication = await Medication.create({
      user: req.userId,
      name,
      dosage,
      frequency,
      instructions,
      times: times || [],
    });

    res.status(201).json(medication);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add medication', details: err.message });
  }
});

router.put('/:id/times', auth, async (req, res) => {
  try {
    const { times } = req.body;
    const medication = await Medication.findOne({ _id: req.params.id, user: req.userId });
    if (!medication) return res.status(404).json({ error: 'Medication not found' });

    medication.times = times || [];
    await medication.save();

    // Replace pending reminders with a fresh set matching the new schedule.
    // (Deleting alone, without regenerating, silently stops future notifications.)
    await Reminder.deleteMany({ medication: medication._id, status: 'pending' });
    await createRemindersForMedication(medication);

    res.json(medication);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update times', details: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const medication = await Medication.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!medication) return res.status(404).json({ error: 'Medication not found' });

    await Reminder.deleteMany({ medication: medication._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete medication', details: err.message });
  }
});

module.exports = router;
