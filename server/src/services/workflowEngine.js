const Workflow = require('../models/Workflow');
const Ticket = require('../models/Ticket');
const Contact = require('../models/Contact');
const whatsappService = require('./baileysService');

const evaluateConditions = (conditions, eventData) => {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  if (conditions.isFirstMessage) {
    if (!eventData.isFirstMessage) return false;
  }

  if (conditions.messageContains && Array.isArray(conditions.messageContains) && eventData.message) {
    const text = eventData.message.toLowerCase();
    const match = conditions.messageContains.some(keyword => text.includes(keyword.toLowerCase()));
    if (!match) return false;
  }
  
  if (conditions.newStatus && eventData.newStatus) {
    if (conditions.newStatus !== eventData.newStatus) return false;
  }

  return true;
};

const executeAction = async (action, eventData) => {
  const { tenantId, channelId, remoteJid, contactId, ticketId } = eventData;
  const config = action.config || {};

  switch (action.actionType) {
    case 'create_ticket':
      if (channelId && remoteJid) {
        // Prevent creating duplicate open tickets
        const openTicket = await Ticket.findOne({ tenantId, channelId, contactId, status: { $in: ['open', 'in_progress'] } });
        if (!openTicket) {
          const newTicket = new Ticket({
            tenantId,
            channelId,
            contactId,
            conversationId: remoteJid,
            subject: `New Request from ${remoteJid.split('@')[0]}`,
            description: eventData.message || 'Auto-generated ticket',
            priority: config.priority || 'medium',
            status: config.status || 'open'
          });
          await newTicket.save();
        }
      }
      break;

    case 'send_auto_reply':
      if (channelId && remoteJid && config.text) {
        await whatsappService.sendMessage(channelId, remoteJid, config.text);
      }
      break;

    case 'assign_ticket':
      if (ticketId) {
        const update = {};
        if (config.status) update.status = config.status;
        if (config.assignedTo) update.assignedTo = config.assignedTo;
        
        await Ticket.updateOne({ _id: ticketId, tenantId }, update);
      }
      break;

    case 'add_tag':
      if (contactId && config.tag) {
        await Contact.updateOne({ _id: contactId, tenantId }, { $addToSet: { tags: config.tag } });
      }
      break;

    default:
      console.log(`Unknown action type: ${action.actionType}`);
  }
};

const processEvent = async (tenantId, eventType, eventData) => {
  try {
    const workflows = await Workflow.find({ tenantId, triggerEvent: eventType, isActive: true });
    
    for (const workflow of workflows) {
      if (evaluateConditions(workflow.conditions, eventData)) {
        for (const action of workflow.actions) {
          await executeAction(action, eventData);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing workflow event ${eventType}:`, error);
  }
};

module.exports = {
  processEvent
};
