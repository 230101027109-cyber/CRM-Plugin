const express = require('express');
const authenticate = require('../middleware/auth');
const { getChatList, getContacts, getGroups, searchContacts, addContactTag, updateContactNotes, createOrUpdateContact } = require('../controllers/contactController');
const Channel = require('../models/Channel');

const router = express.Router();

router.get('/chats', authenticate, async (req, res) => {
  try {
    const chats = await getChatList(req.user.tenantId);
    res.json({ success: true, data: chats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/contacts', authenticate, async (req, res) => {
  try {
    const contacts = await getContacts(req.user.tenantId);
    res.json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/groups', authenticate, async (req, res) => {
  try {
    const groups = await getGroups(req.user.tenantId);
    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const contacts = await searchContacts(q, req.user.tenantId);
    res.json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, phone, channelId } = req.body;
    if (!name?.trim() || !phone) return res.status(400).json({ success: false, message: 'Name and phone are required' });
    let resolvedChannelId = channelId;
    if (resolvedChannelId) {
      const channel = await Channel.findOne({ tenantId: req.user.tenantId, channelId: resolvedChannelId });
      if (!channel) return res.status(400).json({ success: false, message: 'Invalid channel' });
    } else {
      const channel = await Channel.findOne({ tenantId: req.user.tenantId, status: 'connected' }).sort({ createdAt: 1 });
      if (!channel) return res.status(400).json({ success: false, message: 'Connect a WhatsApp channel before creating a contact' });
      resolvedChannelId = channel.channelId;
    }
    const contact = await createOrUpdateContact(req.user.tenantId, { ...req.body, name: name.trim(), channelId: resolvedChannelId });
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:jid/tags', authenticate, async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ success: false, message: 'Tag required' });
    const contact = await addContactTag(req.user.tenantId, req.params.jid, tag);
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:jid/notes', authenticate, async (req, res) => {
  try {
    const contact = await updateContactNotes(req.user.tenantId, req.params.jid, req.body.notes);
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
