const cron = require('node-cron');
const Reminder = require('../models/Reminder');

// Every 5 minutes, mark reminders more than 30 minutes overdue as "missed"
function startMissedReminderJob() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000);
      const result = await Reminder.updateMany(
        { status: { $in: ['pending', 'snoozed'] }, scheduledTime: { $lt: cutoff } },
        { $set: { status: 'missed' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`Marked ${result.modifiedCount} reminder(s) as missed`);
      }
    } catch (err) {
      console.error('Missed-reminder job failed:', err.message);
    }
  });
}

module.exports = startMissedReminderJob;
