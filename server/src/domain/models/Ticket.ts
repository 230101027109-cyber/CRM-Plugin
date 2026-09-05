import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { TicketStatus, TicketPriority } from '../../shared/types';

export interface ITicket extends Document {
  ticketId: string;
  tenantId: string;
  channelId: string;
  contactId: string;
  conversationId?: string;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo?: mongoose.Types.ObjectId;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    ticketId: { type: String, default: uuidv4, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    contactId: { type: String, required: true, index: true },
    conversationId: { type: String },
    subject: { type: String, required: true },
    description: { type: String },
    status: { 
      type: String, 
      enum: ['open', 'in_progress', 'resolved', 'closed'], 
      default: 'open' 
    },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'urgent'], 
      default: 'medium' 
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

// Indexes
ticketSchema.index({ tenantId: 1, status: 1 });
ticketSchema.index({ tenantId: 1, assignedTo: 1 });

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);
