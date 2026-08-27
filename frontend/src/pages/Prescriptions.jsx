import React, { useEffect, useState } from 'react';
import { Upload, Plus, Clock, Edit } from 'lucide-react';
import {
  uploadPrescription,
  confirmPrescription,
  updateMedicationTimes,
  getPrescriptions,
} from '../services/api';

const Prescriptions = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingTimes, setEditingTimes] = useState(null);

  // Load previously uploaded prescriptions so they don't vanish on refresh
  const loadPrescriptions = async () => {
    setLoading(true);
    try {
      const res = await getPrescriptions();
      setPrescriptions(res.data);
    } catch (error) {
      console.error('Failed to load prescriptions', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrescriptions();
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('prescription', file);

      // api.js returns the raw Axios response — the actual prescription
      // document is under `.data`, not the response object itself.
      const res = await uploadPrescription(formData);
      setPrescriptions((current) => [res.data, ...current]);
      if (!res.data.medications?.length) {
        alert('The prescription was uploaded, but no medication was detected. Please upload a clearer, well-lit image or add it from the Medications page.');
      }
    } catch (error) {
      alert('Error uploading prescription: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleConfirmPrescription = async (prescriptionId) => {
    try {
      // Response is { prescription, medications } under res.data
      const res = await confirmPrescription(prescriptionId);
      const count = res.data?.createdCount ?? res.data?.medications?.length ?? 0;
      if (count === 0) {
        throw new Error('No medications were detected in this prescription.');
      }
      alert(`${count} medication${count === 1 ? '' : 's'} created successfully!`);
      await loadPrescriptions();
    } catch (error) {
      alert('Could not create medications: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditTimes = (prescriptionId, medicationId, currentTimes) => {
    setEditingTimes({ prescriptionId, medicationId, times: currentTimes || [] });
  };

  const handleSaveTimes = async () => {
    if (!editingTimes) return;

    try {
      const res = await updateMedicationTimes(
        editingTimes.prescriptionId,
        editingTimes.medicationId,
        editingTimes.times
      );
      // Reflect the saved times in the list immediately using the server's response
      setPrescriptions(prescriptions.map(p =>
        p._id === res.data._id ? res.data : p
      ));
      setEditingTimes(null);
      alert('Times updated successfully!');
    } catch (error) {
      alert('Error updating times: ' + (error.response?.data?.error || error.message));
    }
  };

  const addTimeSlot = () => {
    if (!editingTimes) return;
    setEditingTimes({
      ...editingTimes,
      times: [...editingTimes.times, { time: '08:00', dosage: '' }]
    });
  };

  const updateTimeSlot = (index, field, value) => {
    if (!editingTimes) return;
    const newTimes = [...editingTimes.times];
    newTimes[index] = { ...newTimes[index], [field]: value };
    setEditingTimes({ ...editingTimes, times: newTimes });
  };

  return (
    <div className="prescriptions-page">
      <div className="page-header">
        <h1>Prescriptions</h1>
        <p>Upload and manage your prescriptions</p>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <div className="upload-card">
          <Upload size={48} />
          <h3>Upload Prescription</h3>
          <p>Take a clear photo of your prescription</p>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="file-input"
          />
          {uploading && <p>Processing prescription…</p>}
        </div>
      </div>

      {/* Prescriptions List */}
      {loading ? (
        <p>Loading…</p>
      ) : prescriptions.length === 0 ? (
        <div className="empty-state">
          <Upload size={40} />
          <p>No prescriptions uploaded yet.</p>
        </div>
      ) : (
        <div className="prescriptions-list">
          {prescriptions.map(prescription => (
            <div key={prescription._id} className="prescription-card">
              <div className="prescription-header">
                <h3>Prescription from {prescription.doctorInfo?.name || 'Unknown Doctor'}</h3>
                <span className={`status ${prescription.status}`}>
                  {prescription.status}
                </span>
              </div>

              {(!prescription.medications || prescription.medications.length === 0) && (
                <p className="no-times">
                  No medication was detected. Upload a clearer, well-lit image or add the medicine manually from the Medications page.
                </p>
              )}

              {prescription.medications?.map((medication, index) => (
                <div key={medication._id || index} className="medication-item">
                  <div className="medication-info">
                    <h4>{medication.name}</h4>
                    <p>{medication.dosage} • {medication.frequency}</p>
                    <p>{medication.instructions}</p>

                    {/* Time Slots */}
                    <div className="time-slots">
                      <div className="time-slots-header">
                        <Clock size={16} />
                        <span>Schedule</span>
                        <button
                          onClick={() => handleEditTimes(
                            prescription._id,
                            medication._id || index,
                            medication.times
                          )}
                          className="edit-times-btn"
                        >
                          <Edit size={14} />
                          Edit Times
                        </button>
                      </div>

                      {medication.times?.length > 0 ? (
                        <div className="time-list">
                          {medication.times.map((timeSlot, timeIndex) => (
                            <div key={timeIndex} className="time-slot">
                              <span className="time">{timeSlot.time}</span>
                              <span className="dosage">{timeSlot.dosage}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-times">No time slots set. Click "Edit Times" to add.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {prescription.status === 'processed' && (
                <button
                  onClick={() => handleConfirmPrescription(prescription._id)}
                  className="confirm-btn btn btn-primary"
                >
                  Confirm and Create Medications
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Times Modal */}
      {editingTimes && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Medication Times</h3>
            <div className="time-slots-editor">
              {editingTimes.times.map((timeSlot, index) => (
                <div key={index} className="time-input-row">
                  <input
                    type="time"
                    value={timeSlot.time}
                    onChange={(e) => updateTimeSlot(index, 'time', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Dosage (e.g., 1 tablet)"
                    value={timeSlot.dosage}
                    onChange={(e) => updateTimeSlot(index, 'dosage', e.target.value)}
                  />
                  <button
                    onClick={() => {
                      const newTimes = editingTimes.times.filter((_, i) => i !== index);
                      setEditingTimes({ ...editingTimes, times: newTimes });
                    }}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button onClick={addTimeSlot} className="add-time-btn">
                <Plus size={16} />
                Add Time Slot
              </button>
            </div>

            <div className="modal-actions">
              <button onClick={() => setEditingTimes(null)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleSaveTimes} className="save-btn">
                Save Times
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Prescriptions;
