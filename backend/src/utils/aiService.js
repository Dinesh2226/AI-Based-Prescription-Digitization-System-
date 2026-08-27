const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

async function processPrescriptionImage(filePath) {
  const form = new FormData();
  form.append('image', fs.createReadStream(filePath));

  const response = await axios.post(`${AI_SERVICE_URL}/process-prescription`, form, {
    headers: form.getHeaders(),
    // Handwritten OCR is run over several overlapping page bands on CPU.
    // Allow enough time for that batch to finish before treating it as offline.
    timeout: 180000,
  });
  return response.data;
}

async function checkInteractions(medications, allergies = []) {
  const response = await axios.post(`${AI_SERVICE_URL}/check-interactions`, {
    medications,
    allergies,
  });
  return response.data;
}

async function suggestTimes(medications) {
  const response = await axios.post(`${AI_SERVICE_URL}/suggest-times`, { medications });
  return response.data;
}

module.exports = { processPrescriptionImage, checkInteractions, suggestTimes };
