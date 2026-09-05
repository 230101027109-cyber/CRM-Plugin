import mongoose, { Document, Schema } from 'mongoose';
import { ConversationStatus } from '../../shared/types';

export interface IContact extends Document {
  tenantId: string;
  channelId: string;
  jid: string;
  aliases: string[];
  name: string;
  phone: string;
  pushName: string;
  businessName: string;
  isBusiness: boolean;
  isGroup: boolean;
  participants: string[];
  profilePicUrl: string;
  lastSeen?: Date;
  isOnline: boolean;
  about: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: Date;
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    tenantId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    jid: { type: String, required: true, index: true },
    aliases: [{ type: String }],
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    pushName: { type: String, default: '' },
    businessName: { type: String, default: '' },
    isBusiness: { type: Boolean, default: false },
    isGroup: { type: Boolean, default: false },
    participants: [{ type: String }],
    profilePicUrl: { type: String, default: '' },
    lastSeen: { type: Date },
    isOnline: { type: Boolean, default: false },
    about: { type: String, default: '' },
    unreadCount: { type: Number, default: 0 },
    lastMessage: { type: String, default: '' },
    lastMessageTime: { type: Date, default: Date.now },
    tags: [{ type: String }],
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Indexes
contactSchema.index({ tenantId: 1, channelId: 1, jid: 1 }, { unique: true });
contactSchema.index({ tenantId: 1, channelId: 1, phone: 1 });
contactSchema.index({ name: 1 });

export const Contact = mongoose.model<IContact>('Contact', contactSchema);
