const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Loading config first means a missing JWT_SECRET crashes the process
// immediately at startup, instead of failing silently on the first login.
const { PORT, MONGODB_URI } = require('./src/config');
const startMissedReminderJob = require('./src/jobs/missedReminders');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/prescriptions', require('./src/routes/prescriptions'));
app.use('/api/medications', require('./src/routes/medications'));
app.use('/api/reminders', require('./src/routes/reminders'));
app.use('/api/users', require('./src/routes/users'));

// Fallback error handler so unexpected errors return JSON, not an HTML stack trace
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error', details: err.message });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startMissedReminderJob();
});

module.exports = app;
