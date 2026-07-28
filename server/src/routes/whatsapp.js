const express = require('express');
const whatsappService = require('../services/baileysService');
const Channel = require('../models/Channel');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/status', async (req, res) => {
  try {
    const channels = await Channel.find({ tenantId: req.user.tenantId });
    const result = channels.map(ch => ({
      channelId: ch.channelId,
      channelName: ch.channelName,
      status: ch.status,
      connected: whatsappService.isSessionConnected(ch.channelId) && ch.status === 'connected',
    }));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:channelId/qr', async (req, res) => {
  try {
    const channel = await Channel.findOne({ channelId: req.params.channelId, tenantId: req.user.tenantId });
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });
    const qr = whatsappService.getQR(channel.channelId);
    res.json({ success: true, qr, waiting: !whatsappService.isSessionConnected(channel.channelId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:channelId/connect', async (req, res) => {
  try {
    const channel = await Channel.findOne({ channelId: req.params.channelId, tenantId: req.user.tenantId });
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

    if (whatsappService.isSessionConnected(channel.channelId)) {
      return res.json({ success: true, message: 'Already connected', connected: true });
    }

    channel.status = 'connecting';
    await channel.save();

    whatsappService.startSession(channel.channelId, channel.sessionId, req.user.tenantId)
      .catch(err => console.error(`Error starting session ${channel.channelId}:`, err));

    res.json({ success: true, message: 'Initializing connection...' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:channelId/disconnect', async (req, res) => {
  try {
    const channel = await Channel.findOne({ channelId: req.params.channelId, tenantId: req.user.tenantId });
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

    await whatsappService.stopSession(channel.channelId);
    channel.status = 'disconnected';
    await channel.save();
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    console.log('[Sync Route] Sync request received for tenant:', req.user.tenantId);
    const { syncContacts } = require('../controllers/contactController');
    const channels = await Channel.find({ tenantId: req.user.tenantId, status: 'connected' });
    console.log('[Sync Route] Connected channels found:', channels.length);
    if (channels.length === 0) {
      return res.json({ success: false, message: 'No connected channels' });
    }
    const channel = channels[0];
    console.log('[Sync Route] Channel:', channel.channelId, 'DB status:', channel.status);
    const sock = whatsappService.getSession(channel.channelId);
    console.log('[Sync Route] Socket found:', !!sock, 'Socket user:', !!sock?.user);
    if (!sock) return res.json({ success: false, message: 'WhatsApp session not active' });
    const store = whatsappService.getStore(channel.channelId);
    console.log('[Sync Route] Store found:', !!store, 'Store chats size:', store?.chats?.size || 0);
    const result = await syncContacts(sock, store, req.user.tenantId, channel.channelId);
    console.log('[Sync Route] Result:', JSON.stringify(result));
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Sync Route] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
