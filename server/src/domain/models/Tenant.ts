import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ITenant extends Document {
  tenantId: string;
  name: string;
  ownerId?: mongoose.Types.ObjectId;
  maxUsers: number;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    tenantId: { type: String, default: uuidv4, unique: true, index: true },
    name: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    maxUsers: { type: Number, default: 3 },
    plan: { type: String, default: 'free' },
  },
  { timestamps: true }
);

export const Tenant = mongoose.model<ITenant>('Tenant', tenantSchema);
