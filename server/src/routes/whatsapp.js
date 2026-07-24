const express = require('express');
const whatsappService = require('../services/baileysService');
const { syncContacts } = require('../controllers/contactController');

const router = express.Router();

router.get('/status', async (req, res) => {
  res.json({
    connected: whatsappService.isConnected(),
    status: whatsappService.isConnected() ? 'connected' : 'disconnected',
  });
});

router.get('/qr', async (req, res) => {
  res.json({ qr: null, waiting: !whatsappService.isConnected() });
});

router.post('/connect', async (req, res) => {
  try {
    if (whatsappService.isConnected()) {
      return res.json({ success: true, message: 'Already connected', connected: true });
    }

    await whatsappService.startWhatsApp();
    res.json({ success: true, message: 'Initializing WhatsApp...' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/disconnect', async (req, res) => {
  const sock = whatsappService.getSocket();
  if (!sock) {
    return res.json({ success: true, message: 'Already disconnected' });
  }
  try {
    await sock.logout();
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const result = await syncContacts(whatsappService.getSocket());
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
