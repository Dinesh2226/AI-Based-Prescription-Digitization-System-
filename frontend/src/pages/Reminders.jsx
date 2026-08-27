import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, AlarmClockOff } from 'lucide-react';
import { getUpcomingReminders, markReminderTaken, snoozeReminder } from '../services/api';

const statusLabels = {
  pending: 'Upcoming',
  snoozed: 'Snoozed',
  taken: 'Taken',
  missed: 'Missed',
};

const Reminders = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getUpcomingReminders();
      setReminders(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleTaken = async (id) => {
    await markReminderTaken(id);
    load();
  };

  const handleSnooze = async (id) => {
    await snoozeReminder(id, 15);
    load();
  };

  return (
    <div className="reminders-page">
      <div className="page-header">
        <h1>Reminders</h1>
        <p>Your upcoming doses for the next 24 hours</p>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : reminders.length === 0 ? (
        <div className="empty-state">
          <Clock3 size={40} />
          <p>Nothing scheduled in the next 24 hours.</p>
        </div>
      ) : (
        <div className="reminder-list">
          {reminders.map((r) => (
            <div key={r._id} className={`reminder-row status-${r.status}`}>
              <div className="reminder-time">
                {new Date(r.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="reminder-info">
                <h4>{r.medication?.name}</h4>
                <p>{r.dosage || r.medication?.dosage}</p>
                <span className="status-chip">{statusLabels[r.status] || r.status}</span>
              </div>
              <div className="reminder-actions">
                <button className="btn btn-primary" onClick={() => handleTaken(r._id)}>
                  <CheckCircle2 size={18} /> Taken
                </button>
                <button className="btn btn-secondary" onClick={() => handleSnooze(r._id)}>
                  <AlarmClockOff size={18} /> Snooze 15m
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reminders;
