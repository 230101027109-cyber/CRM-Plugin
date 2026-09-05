import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ChannelType, ChannelStatus } from '../../shared/types';

export interface IChannel extends Document {
  channelId: string;
  tenantId: string;
  type: ChannelType;
  channelName: string;
  connectedNumber?: string;
  assignedTo?: mongoose.Types.ObjectId;
  status: ChannelStatus;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const channelSchema = new Schema<IChannel>(
  {
    channelId: { type: String, default: uuidv4, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    type: { 
      type: String, 
      enum: ['baileys', 'whatsapp_business'], 
      required: true 
    },
    channelName: { type: String, required: true },
    connectedNumber: { type: String },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { 
      type: String, 
      enum: ['connected', 'disconnected', 'connecting'], 
      default: 'disconnected' 
    },
    sessionId: { type: String },
  },
  { timestamps: true }
);

// Indexes
channelSchema.index({ tenantId: 1 });

export const Channel = mongoose.model<IChannel>('Channel', channelSchema);
