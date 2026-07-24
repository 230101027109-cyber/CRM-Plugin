const { getSocket } = require('../services/baileysService');

const sendMediaMessage = async (sock, jid, options) => {
  if (!options.file) throw new Error('File buffer required');

  let mediaType = options.type;
  let mimetype = options.mimetype || 'application/octet-stream';

  if (mediaType === 'image') {
    const result = await sock.sendMessage(jid, { image: options.file, caption: options.caption || '' });
    return { success: true, messageId: result?.key?.id };
  } else if (mediaType === 'video') {
    const result = await sock.sendMessage(jid, { video: options.file, caption: options.caption || '' });
    return { success: true, messageId: result?.key?.id };
  } else if (mediaType === 'audio') {
    const result = await sock.sendMessage(jid, { audio: options.file, mimetype: 'audio/ogg; codecs=opus' });
    return { success: true, messageId: result?.key?.id };
  } else if (mediaType === 'document') {
    const result = await sock.sendMessage(jid, { document: options.file, mimetype, fileName: options.fileName || 'file' });
    return { success: true, messageId: result?.key?.id };
  } else if (mediaType === 'sticker') {
    const result = await sock.sendMessage(jid, { sticker: options.file });
    return { success: true, messageId: result?.key?.id };
  }

  throw new Error('Unsupported media type');
};

const downloadMedia = async (message) => {
  const sock = getSocket();
  if (!sock) throw new Error('Socket not connected');
  const stream = await sock.downloadMediaMessage(message);
  return stream;
};

const formatJid = (phone) => {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('91') && cleaned.length === 10) cleaned = '91' + cleaned;
  return `${cleaned}@s.whatsapp.net`;
};

const getJidType = (jid) => {
  if (jid.endsWith('@g.us')) return 'group';
  if (jid.endsWith('@s.whatsapp.net')) return 'contact';
  return 'unknown';
};

module.exports = {
  sendMediaMessage,
  downloadMedia,
  formatJid,
  getJidType,
};
