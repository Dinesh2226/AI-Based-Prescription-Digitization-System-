import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pill, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import { getUpcomingReminders, getMedications, markReminderTaken } from '../services/api';

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeUntil(dateStr) {
  const diffMs = new Date(dateStr) - new Date();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin <= 0) return 'now';
  if (diffMin < 60) return `in ${diffMin} min`;
  return `in ${Math.round(diffMin / 60)} hr`;
}

const Dashboard = () => {
  const [reminders, setReminders] = useState([]);
  const [medicationCount, setMedicationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [remindersRes, medsRes] = await Promise.all([
        getUpcomingReminders(),
        getMedications({ active: true }),
      ]);
      setReminders(remindersRes.data);
      setMedicationCount(medsRes.data.length);
      setError('');
    } catch (err) {
      setError('Could not load your dashboard. Is the backend running?');
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

  const nextDose = reminders[0];
  const laterDoses = reminders.slice(1);

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Your day</h1>
        <p>Here's what's coming up next.</p>
      </div>

      {error && <div className="banner banner-error"><AlertTriangle size={20} /> {error}</div>}

      {/* Signature element: the big next-dose ring */}
      <section className="next-dose-card">
        {loading ? (
          <p>Loading…</p>
        ) : nextDose ? (
          <>
            <div className="next-dose-ring" aria-hidden="true">
              <span className="next-dose-time">{formatTime(nextDose.scheduledTime)}</span>
              <span className="next-dose-relative">{timeUntil(nextDose.scheduledTime)}</span>
            </div>
            <div className="next-dose-details">
              <span className="eyebrow">Next dose</span>
              <h2>{nextDose.medication?.name || 'Medication'}</h2>
              <p>{nextDose.dosage || nextDose.medication?.dosage}</p>
              <button className="btn btn-primary btn-large" onClick={() => handleTaken(nextDose._id)}>
                <CheckCircle2 size={22} /> Mark as taken
              </button>
            </div>
          </>
        ) : (
          <div className="next-dose-empty">
            <Clock3 size={40} />
            <h2>No doses due in the next 24 hours</h2>
            <p>Nothing scheduled right now — you're all caught up.</p>
          </div>
        )}
      </section>

      <section className="dashboard-grid">
        <div className="stat-card">
          <Pill size={28} />
          <div>
            <span className="stat-number">{medicationCount}</span>
            <span className="stat-label">Active medications</span>
          </div>
        </div>
        <div className="stat-card">
          <Clock3 size={28} />
          <div>
            <span className="stat-number">{reminders.length}</span>
            <span className="stat-label">Doses in next 24 hrs</span>
          </div>
        </div>
      </section>

      {laterDoses.length > 0 && (
        <section className="upcoming-list">
          <h3>Later today</h3>
          {laterDoses.map((r) => (
            <div key={r._id} className="upcoming-row">
              <span className="upcoming-time">{formatTime(r.scheduledTime)}</span>
              <span className="upcoming-name">{r.medication?.name}</span>
              <button className="btn btn-secondary" onClick={() => handleTaken(r._id)}>
                Mark taken
              </button>
            </div>
          ))}
        </section>
      )}

      <div className="dashboard-links">
        <Link to="/prescriptions" className="btn btn-outline btn-large">Upload a prescription</Link>
        <Link to="/medications" className="btn btn-outline btn-large">View all medications</Link>
      </div>
    </div>
  );
};

export default Dashboard;
