const Channel = require('../models/Channel');
const whatsappService = require('../services/baileysService');

const reconcileChannelStatus = async (channel) => {
  const sessionConnected = whatsappService.isSessionConnected(channel.channelId);
  
  // Socket says connected but DB says otherwise → fix DB
  if (sessionConnected && channel.status !== 'connected') {
    console.log(`[Channel] Reconciling channel ${channel.channelId}: socket connected, DB was '${channel.status}' → fixing to 'connected'`);
    channel.status = 'connected';
    await channel.save();
  }
  // Socket says disconnected but DB says connected → fix DB
  else if (!sessionConnected && channel.status === 'connected') {
    console.log(`[Channel] Reconciling channel ${channel.channelId}: socket disconnected, DB was 'connected' → fixing to 'disconnected'`);
    channel.status = 'disconnected';
    await channel.save();
  }
  // Socket says disconnected but DB says connecting (stale) → fix DB
  else if (!sessionConnected && channel.status === 'connecting') {
    console.log(`[Channel] Reconciling channel ${channel.channelId}: socket disconnected, DB was 'connecting' → fixing to 'disconnected'`);
    channel.status = 'disconnected';
    await channel.save();
  }
  
  return channel;
};

const getChannels = async (req, res) => {
  try {
    let channels = await Channel.find({ tenantId: req.user.tenantId }).populate('assignedTo', 'firstName lastName');
    // Reconcile each channel's status with actual socket state
    channels = await Promise.all(channels.map(ch => reconcileChannelStatus(ch)));
    res.json({ success: true, data: channels });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getChannelById = async (req, res) => {
  try {
    let channel = await Channel.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).populate('assignedTo', 'firstName lastName');
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });
    channel = await reconcileChannelStatus(channel);
    res.json({ success: true, data: channel });
  } catch (error) {
    console.error('Error fetching channel by id:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createChannel = async (req, res) => {
  try {
    const { type, channelName, assignedTo } = req.body;
    
    if (!type || !channelName) {
      return res.status(400).json({ success: false, message: 'Type and name are required' });
    }

    // Lookup user to get their ObjectId for the assignedTo ref
    const User = require('../models/User');
    const user = await User.findOne({ userId: req.user.userId });

    const channel = new Channel({
      tenantId: req.user.tenantId,
      type,
      channelName,
      assignedTo: assignedTo || user._id,
      sessionId: `session_${req.user.tenantId}_${Date.now()}`
    });

    await channel.save();
    res.json({ success: true, data: channel });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteChannel = async (req, res) => {
  try {
    const channel = await Channel.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

    // Disconnect if connected
    if (channel.status === 'connected') {
      await whatsappService.stopSession(channel.channelId);
    }

    await Channel.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Channel deleted' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const connectChannel = async (req, res) => {
  try {
    const channel = await Channel.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });
    
    if (channel.type === 'whatsapp_business') {
      return res.status(400).json({ success: false, message: 'WhatsApp Business coming soon' });
    }

    if (whatsappService.isSessionConnected(channel.channelId)) {
      return res.json({ success: true, message: 'Already connected', status: 'connected' });
    }

    channel.status = 'connecting';
    await channel.save();

    // Start Baileys session asynchronously
    whatsappService.startSession(channel.channelId, channel.sessionId, req.user.tenantId)
      .catch(err => console.error(`Error starting session ${channel.channelId}:`, err));

    res.json({ success: true, message: 'Initializing connection...' });
  } catch (error) {
    console.error('Error connecting channel:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const disconnectChannel = async (req, res) => {
  try {
    const channel = await Channel.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

    await whatsappService.stopSession(channel.channelId);
    
    channel.status = 'disconnected';
    await channel.save();
    
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting channel:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getChannelQR = async (req, res) => {
  try {
    const channel = await Channel.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });
    
    const qr = whatsappService.getQR(channel.channelId);
    res.json({ success: true, qr });
  } catch (error) {
    console.error('Error fetching channel QR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getChannels,
  getChannelById,
  createChannel,
  deleteChannel,
  connectChannel,
  disconnectChannel,
  getChannelQR
};
