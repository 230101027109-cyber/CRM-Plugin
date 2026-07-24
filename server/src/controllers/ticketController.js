const Ticket = require('../models/Ticket');

const getTickets = async (req, res) => {
  try {
    const { status, priority, assignedTo } = req.query;
    const query = { tenantId: req.user.tenantId };
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;

    const tickets = await Ticket.find(query)
      .populate('assignedTo', 'firstName lastName')
      .populate('channelId', 'channelName')
      .sort({ createdAt: -1 });
      
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate('assignedTo', 'firstName lastName')
      .populate('channelId', 'channelName');
      
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createTicket = async (req, res) => {
  try {
    const { channelId, contactId, conversationId, subject, description, priority, assignedTo, tags } = req.body;
    
    if (!channelId || !contactId || !subject) {
      return res.status(400).json({ success: false, message: 'channelId, contactId, and subject are required' });
    }

    const ticket = new Ticket({
      tenantId: req.user.tenantId,
      channelId,
      contactId,
      conversationId,
      subject,
      description,
      priority: priority || 'medium',
      assignedTo,
      tags: tags || []
    });

    await ticket.save();
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateTicket = async (req, res) => {
  try {
    const { status, priority, assignedTo } = req.body;
    
    const update = {};
    if (status) update.status = status;
    if (priority) update.priority = priority;
    if (assignedTo !== undefined) update.assignedTo = assignedTo;

    const ticket = await Ticket.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      update,
      { new: true }
    ).populate('assignedTo', 'firstName lastName');

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket
};
