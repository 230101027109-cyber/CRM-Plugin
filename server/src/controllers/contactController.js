const crypto = require('crypto');
const Contact = require('../models/Contact');
const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const { redisClient, ensureRedisConnection, releaseLock } = require('../config/redis');
const { buildConversationKey } = require('../utils/conversationKey');

const SYNC_LOCK_TTL_SECONDS = 10 * 60;
const SYNC_STATE_TTL_SECONDS = 30 * 24 * 60 * 60;

const contactSyncLockKey = (tenantId, channelId) =>
  `crm:contacts:sync:lock:${tenantId}:${channelId}`;

const contactSyncStateKey = (tenantId, channelId) =>
  `crm:contacts:sync:state:${tenantId}:${channelId}`;

const contactFingerprintKey = (tenantId, channelId) =>
  `crm:contacts:sync:fingerprint:${tenantId}:${channelId}`;

const normaliseString = (value) => String(value ?? '').trim();

const normalisePhone = (jidOrPhone) => {
  const raw = normaliseString(jidOrPhone);
  if (!raw || raw.includes('@lid')) return '';

  return raw
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');
};

const isSyncableJid = (jid) => {
  const value = normaliseString(jid);
  if (!value) return false;
  if (value.includes('@g.us')) return false;
  if (value.includes('@broadcast')) return false;
  if (value.includes('@newsletter')) return false;
  if (value.includes('@lid')) return false;
  return value.includes('@s.whatsapp.net');
};

const cleanName = (value, phone = '') => {
  const name = normaliseString(value);
  if (!name) return '';

  const digitsOnlyName = name.replace(/\D/g, '');
  if (phone && digitsOnlyName && digitsOnlyName === phone) return '';

  const invalidNames = new Set(['unknown', 'undefined', 'null', 'n/a', 'na', '-']);
  if (invalidNames.has(name.toLowerCase())) return '';

  return name;
};

const cleanText = (value) => normaliseString(value);

const pickDisplayName = (candidate, existing = null) => {
  // We intentionally prefer an explicit WhatsApp/address-book name over a
  // pushName/notify fallback. A weaker fallback should never erase a good name.
  const phone = candidate.phone || existing?.phone || '';
  const incomingName = cleanName(candidate.name, phone);
  const incomingVerifiedName = cleanName(candidate.verifiedName, phone);
  const incomingBusinessName = cleanName(candidate.businessName, phone);
  const incomingNotify = cleanName(candidate.notify, phone);
  const incomingPushName = cleanName(candidate.pushName, phone);

  if (incomingName) return incomingName;
  if (incomingVerifiedName) return incomingVerifiedName;
  if (incomingBusinessName) return incomingBusinessName;
  if (incomingNotify) return incomingNotify;
  if (incomingPushName) return incomingPushName;

  const existingName = cleanName(existing?.name, phone);
  if (existingName) return existingName;

  return phone;
};

const pickPushName = (candidate, existing = null) => {
  const phone = candidate.phone || existing?.phone || '';

  return (
    cleanName(candidate.pushName, phone) ||
    cleanName(candidate.notify, phone) ||
    cleanName(candidate.name, phone) ||
    cleanName(existing?.pushName, phone) ||
    ''
  );
};

const mergeCandidate = (map, data) => {
  const jid = normaliseString(data.jid);
  if (!isSyncableJid(jid)) return;

  const phone = normalisePhone(jid);
  if (!phone) return;

  const current = map.get(jid) || {
    tenantId: data.tenantId,
    channelId: data.channelId,
    jid,
    phone,
    name: '',
    verifiedName: '',
    businessName: '',
    notify: '',
    pushName: '',
    isBusiness: false,
    isGroup: false,
    profilePicUrl: '',
    about: '',
    lastMessage: '',
    lastMessageTime: null,
  };

  const incoming = {
    ...data,
    jid,
    phone,
  };

  if (cleanName(incoming.name, phone)) current.name = cleanName(incoming.name, phone);
  if (cleanName(incoming.verifiedName, phone)) current.verifiedName = cleanName(incoming.verifiedName, phone);
  if (cleanName(incoming.businessName, phone)) current.businessName = cleanName(incoming.businessName, phone);
  if (cleanName(incoming.notify, phone)) current.notify = cleanName(incoming.notify, phone);
  if (cleanName(incoming.pushName, phone)) current.pushName = cleanName(incoming.pushName, phone);

  if (incoming.isBusiness !== undefined) current.isBusiness = Boolean(incoming.isBusiness) || current.isBusiness;
  if (cleanText(incoming.profilePicUrl)) current.profilePicUrl = cleanText(incoming.profilePicUrl);
  if (cleanText(incoming.about)) current.about = cleanText(incoming.about);
  if (cleanText(incoming.lastMessage)) current.lastMessage = cleanText(incoming.lastMessage);

  if (incoming.lastMessageTime) {
    const time = new Date(incoming.lastMessageTime);
    if (!Number.isNaN(time.getTime()) && (!current.lastMessageTime || time > new Date(current.lastMessageTime))) {
      current.lastMessageTime = time;
    }
  }

  map.set(jid, current);
};

const getStoreValues = (collection) => {
  if (!collection) return [];
  if (typeof collection.toJSON === 'function') return Object.values(collection.toJSON());
  if (collection instanceof Map) return Array.from(collection.values());
  if (Array.isArray(collection)) return collection;
  if (typeof collection === 'object') return Object.values(collection);
  return [];
};

const buildContactFingerprint = (contact) => {
  const payload = {
    jid: contact.jid,
    phone: contact.phone,
    name: contact.name,
    pushName: contact.pushName,
    businessName: contact.businessName,
    isBusiness: Boolean(contact.isBusiness),
    profilePicUrl: contact.profilePicUrl,
    about: contact.about,
    lastMessage: contact.lastMessage,
    lastMessageTime: contact.lastMessageTime ? new Date(contact.lastMessageTime).toISOString() : '',
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
};

const getRedisHash = async (key, field) => {
  return redisClient.hGet(key, field);
};

const setRedisHash = async (key, field, value) => {
  await redisClient.hSet(key, field, value);
};

const getChatList = async (tenantId) => {
  const conversations = await Conversation.find({ tenantId })
    .sort({ lastMessageTime: -1 })
    .limit(100)
    .lean();

  return conversations.map((conversation) => ({
    conversationId: conversation.conversationId,
    contactId: conversation.contactId || null,
    jid: conversation.contactJid,
    name: conversation.name || conversation.phone || conversation.contactJid,
    phone: conversation.phone || '',
    isGroup: Boolean(conversation.isGroup),
    channelId: conversation.channelId,
    conversationKey: buildConversationKey(
      conversation.channelId,
      conversation.contactJid
    ),
    lastMessage: conversation.lastMessage || '',
    lastMessageTime: conversation.lastMessageTime,
    unreadCount: Number(conversation.unreadCount || 0),
  }));
};

const getContacts = async (tenantId) => {
  return await Contact.find(
    { tenantId, isGroup: false },
    'jid name phone pushName isBusiness isOnline channelId about profilePicUrl lastSeen tags'
  )
    .sort({ name: 1 })
    .limit(500);
};

const getGroups = async (tenantId) => {
  return await Contact.find(
    { tenantId, isGroup: true },
    'jid name subject participantCount profilePicUrl lastMessage lastMessageTime channelId'
  )
    .sort({ lastMessageTime: -1 });
};

const syncContacts = async (sock, store, tenantId, channelId) => {
  if (!sock) throw new Error('WhatsApp socket not connected');
  if (!tenantId) throw new Error('tenantId is required');
  if (!channelId) throw new Error('channelId is required');

  const lockKey = contactSyncLockKey(tenantId, channelId);
  const stateKey = contactSyncStateKey(tenantId, channelId);
  const fingerprintKey = contactFingerprintKey(tenantId, channelId);
  const lockToken = crypto.randomUUID();
  let redisAvailable = true;
  let lockAcquired = false;

  try {
    await ensureRedisConnection();
    lockAcquired = await redisClient.set(lockKey, lockToken, {
      NX: true,
      EX: SYNC_LOCK_TTL_SECONDS,
    });
  } catch (error) {
    // Redis provides coordination and incremental-sync state, but it must not
    // make WhatsApp contact import unavailable when MongoDB is healthy.
    redisAvailable = false;
    console.warn(`[Sync] Redis unavailable; continuing without sync state: ${error.message}`);
  }

  if (redisAvailable && lockAcquired !== 'OK') {
    return {
      success: false,
      skipped: true,
      reason: 'sync_in_progress',
      tenantId,
      channelId,
    };
  }

  try {
    const state = redisAvailable ? await redisClient.hGetAll(stateKey) : {};
    const isInitialSync = state.initialSyncCompleted !== 'true';

    console.log(
      `[Sync] ${isInitialSync ? 'Initial' : 'Incremental'} sync started for tenant=${tenantId}, channel=${channelId}`
    );

    const candidates = new Map();

    // 1. Groups. Groups are kept in the same Contact collection but are
    // channel-scoped just like normal contacts.
    const groups = await sock.groupFetchAllParticipating().catch((error) => {
      console.error('[Sync] groupFetchAllParticipating failed:', error.message);
      return {};
    });

    for (const [jid, group] of Object.entries(groups || {})) {
      if (!jid || !jid.includes('@g.us')) continue;

      const phone = jid.split('@')[0];
      const groupRecord = {
        tenantId,
        channelId,
        jid,
        phone,
        name: group.subject || group.name || '',
        pushName: group.subject || '',
        isGroup: true,
        participants: Array.isArray(group.participants) ? group.participants.map(p => p.id).filter(Boolean) : [],
        profilePicUrl: group.profilePicUrl || '',
        participantCount: Array.isArray(group.participants) ? group.participants.length : 0,
      };

      const existing = candidates.get(jid);
      if (!existing) {
        candidates.set(jid, groupRecord);
      } else {
        candidates.set(jid, {
          ...existing,
          ...groupRecord,
        });
      }
    }

    // 2. Merge store.chats into one candidate per JID.
    for (const chat of getStoreValues(store?.chats)) {
      const jid = chat?.id;
      if (!isSyncableJid(jid)) continue;

      const lastMessage =
        chat.lastMessage?.message?.conversation ||
        chat.lastMessage?.message?.extendedTextMessage?.text ||
        chat.lastMessage?.message?.imageMessage?.caption ||
        chat.lastMessage?.message?.videoMessage?.caption ||
        '';

      mergeCandidate(candidates, {
        tenantId,
        channelId,
        jid,
        name: chat.name || chat.subject || '',
        notify: chat.notify || '',
        pushName: chat.pushName || '',
        lastMessage,
        lastMessageTime: chat.lastMessage?.messageTimestamp
          ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000)
          : null,
      });
    }

    // 3. Merge the dedicated contact store. This usually carries the best
    // address-book/name information.
    for (const contact of getStoreValues(store?.contacts)) {
      const jid = contact?.id || contact?.jid;
      if (!isSyncableJid(jid)) continue;

      mergeCandidate(candidates, {
        tenantId,
        channelId,
        jid,
        name: contact.name || '',
        notify: contact.notify || '',
        pushName: contact.pushName || '',
        verifiedName: contact.verifiedName || '',
        businessName: contact.businessName || '',
        isBusiness: contact.isBusiness,
        profilePicUrl: contact.imgUrl || contact.profilePicUrl || '',
        about: contact.status || contact.about || '',
      });
    }

    // 4. Fallback to sock.contacts for environments where the in-memory store
    // does not expose the full contact map.
    if (sock.contacts) {
      const entries = sock.contacts instanceof Map
        ? Array.from(sock.contacts.entries())
        : Object.entries(sock.contacts);

      for (const [jid, contact] of entries) {
        if (!isSyncableJid(jid)) continue;

        mergeCandidate(candidates, {
          tenantId,
          channelId,
          jid,
          name: contact?.name || '',
          notify: contact?.notify || '',
          pushName: contact?.pushName || '',
          verifiedName: contact?.verifiedName || '',
          businessName: contact?.businessName || '',
          isBusiness: contact?.isBusiness,
          profilePicUrl: contact?.imgUrl || contact?.profilePicUrl || '',
          about: contact?.status || contact?.about || '',
        });
      }
    }

    let scannedCount = candidates.size;
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    for (const candidate of candidates.values()) {
      try {
        const incomingName = pickDisplayName(candidate);
        const incomingPushName = pickPushName(candidate);
        const fingerprintPayload = {
          ...candidate,
          name: incomingName,
          pushName: incomingPushName,
        };
        const fingerprint = buildContactFingerprint(fingerprintPayload);
        const existing = await Contact.findOne({
          tenantId,
          channelId,
          jid: candidate.jid,
        });
        const oldFingerprint = redisAvailable
          ? await getRedisHash(fingerprintKey, candidate.jid)
          : null;

        // A Redis fingerprint can outlive a manually deleted Mongo record.
        // Only skip an unchanged candidate when the contact still exists.
        if (existing && oldFingerprint === fingerprint) {
          unchangedCount++;
          continue;
        }

        const set = {
          tenantId,
          channelId,
          jid: candidate.jid,
          phone: candidate.phone,
          isGroup: Boolean(candidate.isGroup),
        };

        // Never replace a useful stored name with a weak/empty value.
        const existingName = cleanName(existing?.name, candidate.phone);
        const nextName = cleanName(incomingName, candidate.phone);
        if (nextName && (!existingName || existingName === candidate.phone || cleanName(candidate.name, candidate.phone))) {
          set.name = nextName;
        }

        const nextPushName = cleanName(incomingPushName, candidate.phone);
        if (nextPushName) set.pushName = nextPushName;

        if (cleanText(candidate.businessName)) set.businessName = cleanText(candidate.businessName);
        if (candidate.isBusiness) set.isBusiness = true;
        if (cleanText(candidate.profilePicUrl)) set.profilePicUrl = cleanText(candidate.profilePicUrl);
        if (cleanText(candidate.about)) set.about = cleanText(candidate.about);

        if (candidate.isGroup) {
          set.participants = Array.isArray(candidate.participants) ? candidate.participants : [];
          set.participantCount = Array.isArray(candidate.participants) ? candidate.participants.length : 0;
        }

        if (cleanText(candidate.lastMessage)) set.lastMessage = cleanText(candidate.lastMessage);
        if (candidate.lastMessageTime) set.lastMessageTime = new Date(candidate.lastMessageTime);

        const result = await Contact.updateOne(
          {
            tenantId,
            channelId,
            jid: candidate.jid,
          },
          {
            $set: set,
          },
          { upsert: true }
        );

        if (result.upsertedCount > 0) createdCount++;
        else updatedCount++;

        // History messages can create a conversation before the richer
        // WhatsApp contact record is synced. Attach the contact and refresh
        // its display data once the contact becomes available.
        const persistedContact = await Contact.findOne({
          tenantId,
          channelId,
          jid: candidate.jid,
        }).select('_id name pushName businessName phone isGroup');

        if (persistedContact) {
          await Conversation.updateMany(
            { tenantId, channelId, contactJid: candidate.jid },
            {
              $set: {
                contactId: persistedContact._id,
                name: pickDisplayName(candidate, persistedContact),
                phone: persistedContact.phone || candidate.phone,
                isGroup: Boolean(persistedContact.isGroup),
              },
            }
          );
        }

        if (redisAvailable) {
          await setRedisHash(fingerprintKey, candidate.jid, fingerprint);
        }
      } catch (error) {
        errorCount++;
        console.error(`[Sync] Failed to persist ${candidate.jid}:`, error.message);
      }
    }

    const now = new Date().toISOString();
    if (redisAvailable) {
      await redisClient.hSet(stateKey, {
        initialSyncCompleted: 'true',
        lastSyncAt: now,
        lastSyncMode: isInitialSync ? 'initial' : 'incremental',
        lastScannedCount: String(scannedCount),
        lastCreatedCount: String(createdCount),
        lastUpdatedCount: String(updatedCount),
        lastUnchangedCount: String(unchangedCount),
        lastErrorCount: String(errorCount),
      });
      await redisClient.expire(stateKey, SYNC_STATE_TTL_SECONDS);
      await redisClient.expire(fingerprintKey, SYNC_STATE_TTL_SECONDS);
    }

    const result = {
      success: true,
      skipped: false,
      mode: isInitialSync ? 'initial' : 'incremental',
      tenantId,
      channelId,
      scanned: scannedCount,
      created: createdCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      errors: errorCount,
      synced: createdCount + updatedCount,
      redisAvailable,
    };

    console.log(`[Sync] Completed: ${JSON.stringify(result)}`);
    return result;
  } finally {
    try {
      if (redisAvailable && lockAcquired === 'OK') {
        await releaseLock(lockKey, lockToken);
      }
    } catch (error) {
      console.error(`[Sync] Failed to release Redis lock ${lockKey}:`, error.message);
    }
  }
};

const getContactSyncStatus = async (tenantId, channelId) => {
  try {
    await ensureRedisConnection();

    const state = await redisClient.hGetAll(contactSyncStateKey(tenantId, channelId));
    const lockExists = Boolean(await redisClient.exists(contactSyncLockKey(tenantId, channelId)));

    return {
      initialSyncCompleted: state.initialSyncCompleted === 'true',
      lastSyncAt: state.lastSyncAt || null,
      lastSyncMode: state.lastSyncMode || null,
      lastScannedCount: Number(state.lastScannedCount || 0),
      lastCreatedCount: Number(state.lastCreatedCount || 0),
      lastUpdatedCount: Number(state.lastUpdatedCount || 0),
      lastUnchangedCount: Number(state.lastUnchangedCount || 0),
      lastErrorCount: Number(state.lastErrorCount || 0),
      syncInProgress: lockExists,
      redisAvailable: true,
    };
  } catch (error) {
    console.warn(`[Sync] Could not read sync status from Redis: ${error.message}`);
    return {
      initialSyncCompleted: false,
      lastSyncAt: null,
      lastSyncMode: null,
      lastScannedCount: 0,
      lastCreatedCount: 0,
      lastUpdatedCount: 0,
      lastUnchangedCount: 0,
      lastErrorCount: 0,
      syncInProgress: false,
      redisAvailable: false,
    };
  }
};

const createOrUpdateContact = async (tenantId, data) => {
  const phone = String(data.phone || '').replace(/\D/g, '');
  if (!phone) throw new Error('A valid phone number is required');

  const jid = data.jid || `${phone}@s.whatsapp.net`;
  const channelId = data.channelId || data.channel || null;

  if (!channelId) throw new Error('channelId is required');

  return await Contact.findOneAndUpdate(
    { tenantId, channelId, $or: [{ jid }, { phone }] },
    {
      ...data,
      tenantId,
      channelId,
      jid,
      phone,
      isGroup: false,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const mergeContactIdentity = async ({
  tenantId,
  channelId,
  lid,
  jid,
}) => {
  if (!tenantId || !channelId || !lid || !jid) {
    return jid;
  }

  if (lid === jid) return jid;

  const phone = jid.split('@')[0].split(':')[0];

  // 1. Move historical messages from LID -> canonical phone JID.
  await ChatMessage.updateMany(
    {
      tenantId,
      channelId,
      remoteJid: lid,
    },
    {
      $set: {
        remoteJid: jid,
      },
    }
  );

  // 2. Find both contact identities inside THIS tenant + channel only.
  const [phoneContact, lidContact] = await Promise.all([
    Contact.findOne({
      tenantId,
      channelId,
      jid,
    }),
    Contact.findOne({
      tenantId,
      channelId,
      jid: lid,
    }),
  ]);

  let canonicalContact;

  if (phoneContact) {
    canonicalContact = phoneContact;

    const aliasesToAdd = [
      lid,
      ...(lidContact?.aliases || []),
    ].filter(Boolean);

    await Contact.updateOne(
      { _id: phoneContact._id },
      {
        $set: {
          channelId,
          phone,
          ...(lidContact?.name && !phoneContact.name
            ? { name: lidContact.name }
            : {}),
          ...(lidContact?.pushName && !phoneContact.pushName
            ? { pushName: lidContact.pushName }
            : {}),
        },
        $addToSet: {
          aliases: {
            $each: aliasesToAdd,
          },
        },
      }
    );

    if (
      lidContact &&
      String(lidContact._id) !== String(phoneContact._id)
    ) {
      await Contact.deleteOne({
        _id: lidContact._id,
      });
    }
  } else if (lidContact) {
    const aliases = [
      ...(lidContact.aliases || []),
      lid,
    ].filter(Boolean);

    canonicalContact = await Contact.findOneAndUpdate(
      {
        _id: lidContact._id,
      },
      {
        $set: {
          tenantId,
          channelId,
          jid,
          phone,
        },
        $addToSet: {
          aliases: {
            $each: aliases,
          },
        },
      },
      {
        new: true,
      }
    );
  } else {
    canonicalContact = await Contact.findOneAndUpdate(
      {
        tenantId,
        channelId,
        jid,
      },
      {
        $setOnInsert: {
          tenantId,
          channelId,
          jid,
          phone,
          isGroup: false,
        },
        $addToSet: {
          aliases: lid,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  // 3. Merge conversations so only the canonical phone conversation remains.
  const [phoneConversation, lidConversation] = await Promise.all([
    Conversation.findOne({
      tenantId,
      channelId,
      contactJid: jid,
    }),
    Conversation.findOne({
      tenantId,
      channelId,
      contactJid: lid,
    }),
  ]);

  if (
    phoneConversation &&
    lidConversation &&
    String(phoneConversation._id) !== String(lidConversation._id)
  ) {
    const phoneLast = phoneConversation.lastMessageTime
      ? new Date(phoneConversation.lastMessageTime).getTime()
      : 0;
    const lidLast = lidConversation.lastMessageTime
      ? new Date(lidConversation.lastMessageTime).getTime()
      : 0;

    const latest = lidLast > phoneLast
      ? lidConversation
      : phoneConversation;

    await Conversation.updateOne(
      { _id: phoneConversation._id },
      {
        $set: {
          contactId: canonicalContact?._id || phoneConversation.contactId,
          contactJid: jid,
          lastMessage: latest.lastMessage || '',
          lastMessageTime:
            latest.lastMessageTime ||
            phoneConversation.lastMessageTime,
          name:
            phoneConversation.name ||
            lidConversation.name ||
            '',
          phone:
            phoneConversation.phone ||
            lidConversation.phone ||
            phone,
          status:
            phoneConversation.status === 'archived'
              ? 'archived'
              : latest.status || 'active',
          unreadCount:
            Number(phoneConversation.unreadCount || 0) +
            Number(lidConversation.unreadCount || 0),
        },
      }
    );

    await Conversation.deleteOne({
      _id: lidConversation._id,
    });
  } else if (lidConversation) {
    await Conversation.updateOne(
      { _id: lidConversation._id },
      {
        $set: {
          tenantId,
          channelId,
          contactId: canonicalContact?._id,
          contactJid: jid,
          phone,
        },
      }
    );
  } else if (phoneConversation) {
    await Conversation.updateOne(
      { _id: phoneConversation._id },
      {
        $set: {
          contactId: canonicalContact?._id,
          contactJid: jid,
          phone,
        },
      }
    );
  }

  return jid;
};

const addContactTag = async (tenantId, channelId, jid, tag) => {
  return await Contact.findOneAndUpdate(
    { tenantId, channelId, jid },
    { $addToSet: { tags: tag } },
    { new: true }
  );
};

const updateContactNotes = async (tenantId, channelId, jid, notes) => {
  return await Contact.findOneAndUpdate(
    { tenantId, channelId, jid },
    { notes },
    { new: true }
  );
};

const deleteContact = async (tenantId, contactId) => {
  const contact = await Contact.findOne({ _id: contactId, tenantId });
  if (!contact) return { deleted: false, contact: null };

  const contactJids = [contact.jid, ...(contact.aliases || [])].filter(Boolean);

  await Promise.all([
    Contact.deleteOne({ _id: contactId, tenantId }),
    Conversation.deleteMany({ tenantId, contactId }),
    Conversation.deleteMany({
      tenantId,
      channelId: contact.channelId,
      contactJid: { $in: contactJids },
    }),
    ChatMessage.deleteMany({
      tenantId,
      channelId: contact.channelId,
      remoteJid: { $in: contactJids },
    }),
  ]);

  return { deleted: true, contact };
};

const searchContacts = async (query, tenantId) => {
  const regex = new RegExp(query, 'i');
  return await Contact.find({
    tenantId,
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
  getContactSyncStatus,
  createOrUpdateContact,
  mergeContactIdentity,
  addContactTag,
  updateContactNotes,
  deleteContact,
  searchContacts,
};
