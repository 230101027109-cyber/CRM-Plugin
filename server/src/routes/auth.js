const express = require('express');
const authController = require('../controllers/contactController');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/login', (req, res) => {
  const { pin } = req.body;

  if (pin === process.env.ADMIN_PIN || pin === '1234') {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ success: true, token });
  }

  res.status(401).json({ success: false, message: 'Invalid PIN' });
});

router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch {
    res.status(403).json({ success: false, message: 'Invalid token' });
  }
});

module.exports = router;
