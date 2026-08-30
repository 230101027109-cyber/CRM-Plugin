const express = require('express');
const authenticate = require('../middleware/auth');
const { getChatList, getContacts, getGroups, searchContacts, addContactTag, updateContactNotes, createOrUpdateContact, deleteContact } = require('../controllers/contactController');
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
    const { tag, channelId } = req.body;
    if (!tag || !channelId) return res.status(400).json({ success: false, message: 'tag and channelId are required' });
    const contact = await addContactTag(req.user.tenantId, channelId, req.params.jid, tag);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found for this channel' });
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:jid/notes', authenticate, async (req, res) => {
  try {
    const { channelId, notes } = req.body;
    if (!channelId) return res.status(400).json({ success: false, message: 'channelId is required' });
    const contact = await updateContactNotes(req.user.tenantId, channelId, req.params.jid, notes);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found for this channel' });
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await deleteContact(req.user.tenantId, req.params.id);
    if (!result.deleted) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
