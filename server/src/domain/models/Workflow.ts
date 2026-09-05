import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowTriggerEvent, WorkflowActionType, WorkflowCondition, WorkflowAction } from '../../shared/types';

export interface IWorkflow extends Document {
  workflowId: string;
  tenantId: string;
  name: string;
  description?: string;
  triggerEvent: WorkflowTriggerEvent;
  conditions?: WorkflowCondition;
  actions: WorkflowAction[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workflowSchema = new Schema<IWorkflow>(
  {
    workflowId: { type: String, default: uuidv4, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    triggerEvent: {
      type: String,
      enum: ['message_received', 'contact_created', 'ticket_created', 'ticket_status_changed'],
      required: true
    },
    conditions: { type: Schema.Types.Mixed },
    actions: [{
      actionType: { 
        type: String, 
        enum: ['create_ticket', 'assign_ticket', 'send_auto_reply', 'add_tag'], 
        required: true 
      },
      config: { type: Schema.Types.Mixed }
    }],
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
workflowSchema.index({ tenantId: 1, triggerEvent: 1, isActive: 1 });

export const Workflow = mongoose.model<IWorkflow>('Workflow', workflowSchema);
