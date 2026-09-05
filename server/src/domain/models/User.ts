import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '../../shared/types';

export interface IUser extends Document {
  userId: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pin: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    userId: { type: String, default: uuidv4, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    pin: { type: String, required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// Compound indexes
userSchema.index({ tenantId: 1, email: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
