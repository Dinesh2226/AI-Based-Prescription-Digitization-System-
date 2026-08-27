import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach the auth token to every request, if we have one
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token is rejected, clear it so ProtectedRoute sends the user back to /login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const login = (credentials) => api.post('/auth/login', credentials);
export const register = (userData) => api.post('/auth/register', userData);
export const getCurrentUser = () => api.get('/auth/me');

// Prescription APIs
export const uploadPrescription = (formData) =>
  api.post('/prescriptions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getPrescriptions = () => api.get('/prescriptions');
export const confirmPrescription = (prescriptionId) =>
  api.post(`/prescriptions/${prescriptionId}/confirm`);

export const updateMedicationTimes = (prescriptionId, medicationId, times) =>
  api.post(`/prescriptions/${prescriptionId}/medications/${medicationId}/times`, { times });

// Medication APIs
export const getMedications = (params = {}) => api.get('/medications', { params });
export const addMedication = (medicationData) => api.post('/medications', medicationData);
export const updateMedicationTimesDirect = (medicationId, times) =>
  api.put(`/medications/${medicationId}/times`, { times });
export const deleteMedication = (medicationId) => api.delete(`/medications/${medicationId}`);

// Reminder APIs
export const getUpcomingReminders = (hours) => api.get('/reminders/upcoming', { params: { hours } });
export const markReminderTaken = (reminderId) => api.post(`/reminders/${reminderId}/taken`);
export const snoozeReminder = (reminderId, minutes) =>
  api.post(`/reminders/${reminderId}/snooze`, { minutes });

export default api;
