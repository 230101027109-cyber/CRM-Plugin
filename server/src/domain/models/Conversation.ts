import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ConversationStatus } from '../../shared/types';

export interface IConversation extends Document {
  conversationId: string;
  tenantId: string;
  channelId: string;
  contactId?: mongoose.Types.ObjectId;
  contactJid: string;
  name: string;
  phone: string;
  status: ConversationStatus;
  isGroup: boolean;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    conversationId: { type: String, default: uuidv4, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact' },
    contactJid: { type: String, required: true, index: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    status: { 
      type: String, 
      enum: ['open', 'active', 'pending', 'archived'], 
      default: 'open' 
    },
    isGroup: { type: Boolean, default: false },
    unreadCount: { type: Number, default: 0 },
    lastMessage: { type: String, default: '' },
    lastMessageTime: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
conversationSchema.index({ tenantId: 1, channelId: 1, contactJid: 1 }, { unique: true });
conversationSchema.index({ tenantId: 1, status: 1 });

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
