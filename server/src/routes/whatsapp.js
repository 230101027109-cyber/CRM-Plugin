const express = require('express');
const whatsappService = require('../services/baileysService');
const Channel = require('../models/Channel');
const authenticate = require('../middleware/auth');
const { syncContacts, getContactSyncStatus } = require('../controllers/contactController');

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

router.get('/:channelId/sync-status', async (req, res) => {
  try {
    const channel = await Channel.findOne({
      channelId: req.params.channelId,
      tenantId: req.user.tenantId,
    });

    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const status = await getContactSyncStatus(req.user.tenantId, channel.channelId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[Sync Status] Error:', error);
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

// Sync one specific connected WhatsApp channel.
router.post('/:channelId/sync', async (req, res) => {
  try {
    const channel = await Channel.findOne({
      channelId: req.params.channelId,
      tenantId: req.user.tenantId,
    });

    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    if (channel.type !== 'baileys') {
      return res.status(400).json({ success: false, message: 'Contact sync is currently available only for Baileys channels' });
    }

    if (!whatsappService.isSessionConnected(channel.channelId)) {
      return res.status(400).json({ success: false, message: 'WhatsApp channel is not connected' });
    }

    const sock = whatsappService.getSession(channel.channelId);
    const store = whatsappService.getStore(channel.channelId);

    if (!sock) {
      return res.status(400).json({ success: false, message: 'Active WhatsApp session not found' });
    }

    const result = await syncContacts(
      sock,
      store,
      req.user.tenantId,
      channel.channelId
    );

    if (result.skipped && result.reason === 'sync_in_progress') {
      return res.status(409).json({ success: false, message: 'Contact sync is already running', data: result });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Sync Route] Channel sync error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Keep the existing all-connected-channels endpoint for the current UI.
router.post('/sync', async (req, res) => {
  try {
    console.log('[Sync Route] Sync request received for tenant:', req.user.tenantId);

    const channels = await Channel.find({
      tenantId: req.user.tenantId,
      status: 'connected',
      type: 'baileys',
    });

    console.log('[Sync Route] Connected Baileys channels found:', channels.length);

    if (channels.length === 0) {
      return res.json({ success: false, message: 'No connected Baileys channels' });
    }

    const results = [];

    for (const channel of channels) {
      const sock = whatsappService.getSession(channel.channelId);
      if (!sock) {
        results.push({
          channelId: channel.channelId,
          success: false,
          skipped: true,
          reason: 'session_not_found',
        });
        continue;
      }

      const store = whatsappService.getStore(channel.channelId);
      results.push(
        await syncContacts(
          sock,
          store,
          req.user.tenantId,
          channel.channelId
        )
      );
    }

    if (!results.length) {
      return res.json({ success: false, message: 'No active WhatsApp session found' });
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('[Sync Route] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
