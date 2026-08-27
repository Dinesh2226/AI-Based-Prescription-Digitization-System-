const express = require('express');
const auth = require('../middleware/auth');
const Reminder = require('../models/Reminder');

const router = express.Router();

router.get('/upcoming', auth, async (req, res) => {
  try {
    const now = new Date();
    const hoursAhead = Number(req.query.hours) || 24;
    const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const reminders = await Reminder.find({
      user: req.userId,
      status: { $in: ['pending', 'snoozed'] },
      scheduledTime: { $gte: now, $lte: windowEnd },
    })
      .sort({ scheduledTime: 1 })
      .populate('medication', 'name dosage instructions');

    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reminders', details: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const reminders = await Reminder.find({ user: req.userId })
      .sort({ scheduledTime: -1 })
      .limit(200)
      .populate('medication', 'name dosage instructions');
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reminders', details: err.message });
  }
});

router.post('/:id/taken', auth, async (req, res) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params.id, user: req.userId });
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    reminder.status = 'taken';
    reminder.takenAt = new Date();
    await reminder.save();

    res.json(reminder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark reminder taken', details: err.message });
  }
});

router.post('/:id/snooze', auth, async (req, res) => {
  try {
    const minutes = Number(req.body.minutes) || 15;
    const reminder = await Reminder.findOne({ _id: req.params.id, user: req.userId });
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    const newTime = new Date(Date.now() + minutes * 60 * 1000);

    // scheduledTime drives both the /upcoming query and the missed-reminder
    // cron job, so it must move to the new time — otherwise a snoozed
    // reminder whose original time has already passed drops out of
    // /upcoming (scheduledTime < now) and is never picked up again.
    reminder.status = 'snoozed';
    reminder.scheduledTime = newTime;
    reminder.snoozeUntil = newTime;
    await reminder.save();

    res.json(reminder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to snooze reminder', details: err.message });
  }
});

module.exports = router;
