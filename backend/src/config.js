require('dotenv').config();

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required but not set. ' +
    'Copy backend/.env.example to backend/.env and set a long random JWT_SECRET before starting the server.'
  );
}

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/medication-tracker',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:5001',
};
