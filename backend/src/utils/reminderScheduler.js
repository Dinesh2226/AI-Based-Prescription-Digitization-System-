const Reminder = require('../models/Reminder');

/**
 * Generates reminders for the next 7 days based on a medication's daily time slots.
 * Shared by the prescription-confirm flow and the direct medication-edit flow so
 * both regenerate reminders the same way whenever a schedule changes.
 */
async function createRemindersForMedication(medication) {
  if (!medication.times || medication.times.length === 0) return [];

  const reminders = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    for (const slot of medication.times) {
      const [rawHours, rawMinutes] = (slot.time || '08:00').split(':').map(Number);
      // `hours || 8` would silently turn a real midnight (00:00) dose into
      // 08:00, since 0 is falsy in JS. Check for NaN instead so 0 is kept.
      const hours = Number.isNaN(rawHours) ? 8 : rawHours;
      const minutes = Number.isNaN(rawMinutes) ? 0 : rawMinutes;

      const scheduled = new Date(now);
      scheduled.setDate(scheduled.getDate() + dayOffset);
      scheduled.setHours(hours, minutes, 0, 0);

      if (scheduled < now) continue;

      reminders.push({
        user: medication.user,
        medication: medication._id,
        scheduledTime: scheduled,
        dosage: slot.dosage || medication.dosage,
        status: 'pending',
      });
    }
  }

  if (reminders.length) await Reminder.insertMany(reminders);
  return reminders;
}

module.exports = { createRemindersForMedication };
