const Contact = require('../models/Contact');
const ChatMessage = require('../models/ChatMessage');

const getChatList = async () => {
  const contacts = await Contact.find({}, 'jid name phone pushName isGroup lastMessage lastMessageTime isOnline unreadCount profilePicUrl')
    .sort({ lastMessageTime: -1 })
    .limit(100);

  return contacts.map(contact => ({
    jid: contact.jid,
    name: contact.name || contact.pushName || contact.phone,
    phone: contact.phone,
    isGroup: contact.isGroup,
    isOnline: contact.isOnline,
    lastMessage: contact.lastMessage,
    lastMessageTime: contact.lastMessageTime,
    unreadCount: contact.unreadCount,
    profilePicUrl: contact.profilePicUrl,
  }));
};

const getContacts = async () => {
  const contacts = await Contact.find({ isGroup: false }, 'jid name phone pushName isBusiness isOnline about profilePicUrl lastSeen tags')
    .sort({ name: 1 })
    .limit(500);
  return contacts;
};

const getGroups = async () => {
  const groups = await Contact.find({ isGroup: true }, 'jid name subject participantCount profilePicUrl lastMessage lastMessageTime')
    .sort({ lastMessageTime: -1 });
  return groups;
};

const syncContacts = async (sock) => {
  if (!sock) throw new Error('WhatsApp socket not connected');

  const chats = await sock.groupFetchAllParticipating();
  const contacts = await sock.getContacts();

  for (const [jid, contact] of Object.entries(contacts)) {
    await Contact.findOneAndUpdate(
      { jid },
      {
        jid,
        name: contact.name || '',
        pushName: contact.pushName || '',
        phone: contact.phone || '',
        isBusiness: contact.isBusiness || false,
        about: contact.about || '',
        profilePicUrl: contact.profilePicUrl || '',
        isOnline: contact.isOnline || false,
        lastSeen: contact.isOnline ? new Date() : contact.lastSeen,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  for (const [jid, group] of Object.entries(chats)) {
    const existing = await Contact.findOne({ jid });
    if (!existing) {
      await Contact.create({
        jid,
        name: group.subject || group.name || '',
        pushName: group.subject || '',
        isGroup: true,
        participants: group.participants?.map(p => p.id) || [],
        participantCount: group.participants?.length || 0,
        profilePicUrl: group.profilePicUrl || '',
      });
    }
  }

  return true;
};

const createOrUpdateContact = async (data) => {
  return await Contact.findOneAndUpdate(
    { $or: [{ jid: data.jid }, { phone: data.phone }] },
    data,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const addContactTag = async (jid, tag) => {
  return await Contact.findOneAndUpdate(
    { jid },
    { $addToSet: { tags: tag } },
    { new: true }
  );
};

const updateContactNotes = async (jid, notes) => {
  return await Contact.findOneAndUpdate(
    { jid },
    { notes },
    { new: true }
  );
};

const searchContacts = async (query) => {
  const regex = new RegExp(query, 'i');
  return await Contact.find({
    $or: [
      { name: regex },
      { phone: regex },
      { pushName: regex },
      { businessName: regex },
    ]
  }).limit(50);
};

module.exports = {
  getChatList,
  getContacts,
  getGroups,
  syncContacts,
  createOrUpdateContact,
  addContactTag,
  updateContactNotes,
  searchContacts,
};
