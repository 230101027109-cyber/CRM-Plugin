const buildConversationKey = (channelId, remoteJid) => {
  if (!channelId || !remoteJid) return String(remoteJid || '');
  return `${String(channelId)}::${String(remoteJid)}`;
};

const parseConversationKey = (conversationKey) => {
  if (!conversationKey || !conversationKey.includes('::')) {
    return { channelId: '', remoteJid: String(conversationKey || '') };
  }

  const [channelId, ...remoteJidParts] = String(conversationKey).split('::');
  return {
    channelId,
    remoteJid: remoteJidParts.join('::'),
  };
};

module.exports = {
  buildConversationKey,
  parseConversationKey,
};
