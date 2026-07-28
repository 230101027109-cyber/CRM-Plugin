const express = require('express');
const authenticate = require('../middleware/auth');
const { getMessagesForTenant, saveMessage } = require('../controllers/messageController');
const whatsappService = require('../services/baileysService');

const router = express.Router();

router.get('/:remoteJid', authenticate, async (req, res) => {
  try {
    const { remoteJid } = req.params;
    const { limit = 50, before } = req.query;
    const messages = await getMessagesForTenant(req.user.tenantId, remoteJid, parseInt(limit), before);
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/send', authenticate, async (req, res) => {
  try {
    const { channelId, remoteJid, content, type = 'text', file, mimetype, caption, fileName, quotedMessageId } = req.body;
    if (!channelId || !remoteJid || !content) {
      return res.status(400).json({ success: false, message: 'channelId, remoteJid, and content are required' });
    }

    const result = await whatsappService.sendMessage(channelId, remoteJid, content, {
      type,
      file,
      mimetype,
      caption,
      fileName,
      quotedMessageId,
    });

    if (result.success) {
      await saveMessage({
        messageId: result.messageId,
        tenantId: req.user.tenantId,
        channelId,
        remoteJid,
        senderJid: '',
        content,
        messageType: type,
        fromMe: true,
        timestamp: new Date(),
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/send-media', authenticate, async (req, res) => {
  try {
    // Media upload handled via multipart/form-data if needed
    res.json({ success: true, message: 'Media endpoint placeholder' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/upload', authenticate, (req, res) => {
  res.json({ success: true, message: 'Upload endpoint - use multipart/form-data' });
});

module.exports = router;
