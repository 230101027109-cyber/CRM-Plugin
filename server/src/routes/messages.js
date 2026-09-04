const express = require('express');
const authenticate = require('../middleware/auth');
const {
  getMessagesForTenant,
  saveMessage,
} = require('../controllers/messageController');
const whatsappService = require('../services/baileysService');
const Contact = require('../models/Contact');

const router = express.Router();

router.get(
  '/:remoteJid',
  authenticate,
  async (req, res) => {
    try {
      const {
        remoteJid,
      } = req.params;
      const {
        limit = 50,
        before,
        channelId,
      } = req.query;

      if (!channelId) {
        return res.status(400).json({
          success: false,
          message: 'channelId is required',
        });
      }

      const canonicalJid =
        whatsappService.getCanonicalJid(
          channelId,
          remoteJid
        );

      const messages =
        await getMessagesForTenant(
          req.user.tenantId,
          canonicalJid,
          Math.min(
            Math.max(
              parseInt(limit, 10) || 50,
              1
            ),
            100
          ),
          before,
          channelId
        );

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post(
  '/send',
  authenticate,
  async (req, res) => {
    try {
      let {
        channelId,
        remoteJid,
        content,
        type = 'text',
        file,
        mimetype,
        caption,
        fileName,
        quotedMessageId,
      } = req.body;

      if (!remoteJid || !content) {
        return res.status(400).json({
          success: false,
          message:
            'remoteJid and content are required',
        });
      }

      if (!channelId) {
        return res.status(400).json({
          success: false,
          message: 'channelId is required',
        });
      }

      // The selected conversation determines the channel.
      // Never search a tenant-wide contact by JID to guess it.
      const contact =
        await Contact.findOne({
          tenantId:
            req.user.tenantId,
          channelId,
          $or: [
            { jid: remoteJid },
            { aliases: remoteJid },
          ],
        }).select(
          'jid aliases'
        );

      if (!contact) {
        return res.status(404).json({
          success: false,
          message:
            'Contact was not found for this channel',
        });
      }

      const canonicalJid =
        whatsappService.getCanonicalJid(
          channelId,
          contact.jid
        );

      if (
        !canonicalJid
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Could not resolve contact to a canonical WhatsApp JID',
        });
      }

      const result =
        await whatsappService.sendMessage(
          channelId,
          canonicalJid,
          content,
          {
            type,
            file,
            mimetype,
            caption,
            fileName,
            quotedMessageId,
          }
        );

      if (result.success) {
        // Persist here only as a fallback. Baileys' messages.upsert is the
        // canonical event and the unique message index prevents duplication.
        await saveMessage({
          messageId:
            result.messageId,
          tenantId:
            req.user.tenantId,
          channelId,
          remoteJid:
            result.remoteJid ||
            canonicalJid,
          senderJid:
            result.remoteJid ||
            canonicalJid,
          content,
          caption,
          messageType: type,
          fromMe: true,
          timestamp:
            result.timestamp ||
            new Date(),
        });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post(
  '/send-media',
  authenticate,
  async (req, res) => {
    res.json({
      success: true,
      message:
        'Media endpoint placeholder',
    });
  }
);

router.post(
  '/upload',
  authenticate,
  (req, res) => {
    res.json({
      success: true,
      message:
        'Upload endpoint - use multipart/form-data',
    });
  }
);

module.exports = router;
