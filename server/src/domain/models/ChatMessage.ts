import mongoose, { Document, Schema } from 'mongoose';
import { MessageType } from '../../shared/types';

export interface IChatMessage extends Document {
  tenantId: string;
  channelId: string;
  messageId: string;
  remoteJid: string;
  senderJid: string;
  messageType: MessageType;
  content: string;
  caption: string;
  fromMe: boolean;
  timestamp: Date;
  read: boolean;
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    tenantId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    remoteJid: { type: String, required: true, index: true },
    senderJid: { type: String, required: true },
    messageType: { 
      type: String, 
      enum: ['text', 'image', 'video', 'audio', 'document', 'sticker'], 
      default: 'text' 
    },
    content: { type: String, default: '' },
    caption: { type: String, default: '' },
    fromMe: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now, index: true },
    read: { type: Boolean, default: false },
    participants: [{ type: String }],
  },
  { timestamps: true }
);

// Indexes
chatMessageSchema.index({ tenantId: 1, remoteJid: 1, timestamp: -1 });
chatMessageSchema.index({ tenantId: 1, channelId: 1, messageId: 1 }, { unique: true });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
