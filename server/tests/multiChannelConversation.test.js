const test = require('node:test');
const assert = require('node:assert/strict');
const { buildConversationKey, parseConversationKey } = require('../src/utils/conversationKey');

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
