import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pill } from 'lucide-react';
import { getMedications, addMedication } from '../services/api';

const emptyForm = { name: '', dosage: '', frequency: 'once daily', instructions: '' };

const Medications = () => {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMedications();
      setMedications(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addMedication(form);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="medications-page">
      <div className="page-header">
        <h1>Medications</h1>
        <p>Everything you're currently taking</p>
        <button className="btn btn-primary btn-large" onClick={() => setShowForm(!showForm)}>
          <Plus size={20} /> {showForm ? 'Cancel' : 'Add medication'}
        </button>
      </div>

      {showForm && (
        <form className="medication-form" onSubmit={handleAdd}>
          <label htmlFor="med-name">Name</label>
          <input id="med-name" value={form.name} onChange={update('name')} required />

          <label htmlFor="med-dosage">Dosage</label>
          <input id="med-dosage" value={form.dosage} onChange={update('dosage')} placeholder="e.g. 10mg" />

          <label htmlFor="med-frequency">Frequency</label>
          <select id="med-frequency" value={form.frequency} onChange={update('frequency')}>
            <option>once daily</option>
            <option>twice daily</option>
            <option>three times daily</option>
            <option>four times daily</option>
            <option>as needed</option>
          </select>

          <label htmlFor="med-instructions">Instructions</label>
          <input id="med-instructions" value={form.instructions} onChange={update('instructions')} placeholder="e.g. take with food" />

          <button type="submit" className="btn btn-primary btn-large" disabled={saving}>
            {saving ? 'Saving…' : 'Save medication'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : medications.length === 0 ? (
        <div className="empty-state">
          <Pill size={40} />
          <p>No medications yet. Add one, or upload a prescription to get started.</p>
        </div>
      ) : (
        <div className="medication-grid">
          {medications.map((med) => (
            <div key={med._id} className="medication-card">
              <div className="medication-card-header">
                <h3>{med.name}</h3>
                <span className={`pill-badge ${med.active ? 'active' : 'inactive'}`}>
                  {med.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p>{med.dosage} • {med.frequency}</p>
              {med.instructions && <p className="medication-instructions">{med.instructions}</p>}
              {med.times?.length > 0 && (
                <div className="medication-times">
                  {med.times.map((t, i) => (
                    <span key={i} className="time-chip">{t.time}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Medications;
