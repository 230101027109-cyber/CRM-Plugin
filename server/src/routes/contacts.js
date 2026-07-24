const express = require('express');
const authenticate = require('../middleware/auth');
const { getChatList, getContacts, getGroups, searchContacts, addContactTag, updateContactNotes, createOrUpdateContact } = require('../controllers/contactController');

const router = express.Router();

router.get('/chats', authenticate, async (req, res) => {
  try {
    const chats = await getChatList();
    res.json({ success: true, data: chats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/contacts', authenticate, async (req, res) => {
  try {
    const contacts = await getContacts();
    res.json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/groups', authenticate, async (req, res) => {
  try {
    const groups = await getGroups();
    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const contacts = await searchContacts(q);
    res.json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const contact = await createOrUpdateContact(req.body);
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:jid/tags', authenticate, async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ success: false, message: 'Tag required' });
    const contact = await addContactTag(req.params.jid, tag);
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:jid/notes', authenticate, async (req, res) => {
  try {
    const contact = await updateContactNotes(req.params.jid, req.body.notes);
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
