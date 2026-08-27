const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.toSafeObject());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, allergies } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (allergies !== undefined) user.allergies = allergies;
    await user.save();

    res.json(user.toSafeObject());
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

module.exports = router;
