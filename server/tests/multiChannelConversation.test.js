const test = require('node:test');
const assert = require('node:assert/strict');
const { buildConversationKey, parseConversationKey } = require('../src/utils/conversationKey');
const Conversation = require('../src/models/Conversation');
const Contact = require('../src/models/Contact');
const { updateConversationFromMessage } = require('../src/controllers/conversationController');

test('same remote jid on different channels must map to different conversation keys', () => {
  const keyA = buildConversationKey('channel-1', '919876543210@s.whatsapp.net');
  const keyB = buildConversationKey('channel-2', '919876543210@s.whatsapp.net');

  assert.notEqual(keyA, keyB);
  assert.deepEqual(parseConversationKey(keyA), { channelId: 'channel-1', remoteJid: '919876543210@s.whatsapp.net' });
  assert.deepEqual(parseConversationKey(keyB), { channelId: 'channel-2', remoteJid: '919876543210@s.whatsapp.net' });
});

test('same channel and jid must reuse the same conversation key', () => {
  const keyA = buildConversationKey('channel-7', '12025550123@s.whatsapp.net');
  const keyB = buildConversationKey('channel-7', '12025550123@s.whatsapp.net');

  assert.equal(keyA, keyB);
});

test('message conversation upsert never assigns the same field through two operators', async () => {
  const originalContactFindOne = Contact.findOne;
  const originalConversationFindOne = Conversation.findOne;
  const originalFindOneAndUpdate = Conversation.findOneAndUpdate;
  let capturedUpdate;

  try {
    Contact.findOne = () => ({ lean: async () => null });
    Conversation.findOne = () => ({ lean: async () => null });
    Conversation.findOneAndUpdate = async (_filter, update) => {
      capturedUpdate = update;
      return { conversationId: 'conversation-1' };
    };

    await updateConversationFromMessage({
      tenantId: 'tenant-1',
      channelId: 'channel-1',
      remoteJid: '919876543210@s.whatsapp.net',
      content: 'hello',
      timestamp: new Date(),
      fromMe: false,
    });

    const insertedFields = Object.keys(capturedUpdate.$setOnInsert || {});
    const setFields = Object.keys(capturedUpdate.$set || {});
    const incrementedFields = Object.keys(capturedUpdate.$inc || {});

    for (const field of insertedFields) {
      assert.equal(setFields.includes(field), false);
      assert.equal(incrementedFields.includes(field), false);
    }
    for (const field of setFields) {
      assert.equal(incrementedFields.includes(field), false);
    }
  } finally {
    Contact.findOne = originalContactFindOne;
    Conversation.findOne = originalConversationFindOne;
    Conversation.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
