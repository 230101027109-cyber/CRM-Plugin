const Workflow = require('../models/Workflow');

const getWorkflows = async (req, res) => {
  try {
    const workflows = await Workflow.find({ tenantId: req.user.tenantId }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, data: workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createWorkflow = async (req, res) => {
  try {
    const { name, description, triggerEvent, conditions, actions } = req.body;
    
    if (!name || !triggerEvent || !actions || actions.length === 0) {
      return res.status(400).json({ success: false, message: 'Name, triggerEvent, and actions are required' });
    }

    const workflow = new Workflow({
      tenantId: req.user.tenantId,
      name,
      description,
      triggerEvent,
      conditions,
      actions,
      isDefault: false
    });

    await workflow.save();
    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateWorkflow = async (req, res) => {
  try {
    const { name, description, conditions, actions, isActive } = req.body;
    const workflow = await Workflow.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    // Allow updating isActive for default workflows, but not other fields
    if (workflow.isDefault) {
      if (isActive !== undefined) workflow.isActive = isActive;
    } else {
      if (name) workflow.name = name;
      if (description !== undefined) workflow.description = description;
      if (conditions) workflow.conditions = conditions;
      if (actions) workflow.actions = actions;
      if (isActive !== undefined) workflow.isActive = isActive;
    }

    await workflow.save();
    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteWorkflow = async (req, res) => {
  try {
    const workflow = await Workflow.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
    
    if (workflow.isDefault) {
      return res.status(400).json({ success: false, message: 'Cannot delete default workflow' });
    }

    await Workflow.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const seedDefaultWorkflows = async (tenantId) => {
  try {
    const existing = await Workflow.countDocuments({ tenantId, isDefault: true });
    if (existing > 0) return;

    const defaults = [
      {
        tenantId,
        name: 'Auto-Create Ticket',
        description: 'Automatically creates a medium priority ticket for new messages if no open ticket exists.',
        triggerEvent: 'message_received',
        conditions: { isFirstMessage: true },
        actions: [{ actionType: 'create_ticket', config: { priority: 'medium', status: 'open' } }],
        isDefault: true
      },
      {
        tenantId,
        name: 'Welcome Message',
        description: 'Sends a greeting when a new contact is created.',
        triggerEvent: 'contact_created',
        conditions: {},
        actions: [{ actionType: 'send_auto_reply', config: { text: "Thanks for reaching out! We'll get back to you shortly." } }],
        isDefault: true
      },
      {
        tenantId,
        name: 'Urgent Keyword Alert',
        description: 'Sets ticket priority to urgent if message contains urgent keywords.',
        triggerEvent: 'message_received',
        conditions: { messageContains: ['urgent', 'emergency', 'help ASAP'] },
        actions: [{ actionType: 'create_ticket', config: { priority: 'urgent', status: 'open' } }],
        isDefault: true
      },
      {
        tenantId,
        name: 'Auto-Close Resolved',
        description: 'Closes a resolved ticket immediately (simplified).',
        triggerEvent: 'ticket_status_changed',
        conditions: { newStatus: 'resolved' },
        actions: [{ actionType: 'assign_ticket', config: { status: 'closed' } }], // repurposing action slightly for simplicity
        isDefault: true
      }
    ];

    await Workflow.insertMany(defaults);
  } catch (error) {
    console.error('Error seeding default workflows:', error);
  }
};

module.exports = {
  getWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  seedDefaultWorkflows
};
