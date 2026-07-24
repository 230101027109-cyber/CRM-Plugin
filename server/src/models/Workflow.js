const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const workflowSchema = new mongoose.Schema({
  workflowId: { type: String, default: uuidv4, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  triggerEvent: { 
    type: String, 
    enum: ['message_received', 'contact_created', 'ticket_created', 'ticket_status_changed'],
    required: true 
  },
  conditions: { type: mongoose.Schema.Types.Mixed }, // e.g., { messageContains: "help" }
  actions: [{
    actionType: { type: String, enum: ['create_ticket', 'assign_ticket', 'send_auto_reply', 'add_tag'], required: true },
    config: { type: mongoose.Schema.Types.Mixed }
  }],
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

workflowSchema.index({ tenantId: 1, triggerEvent: 1, isActive: 1 });

module.exports = mongoose.model('Workflow', workflowSchema);
