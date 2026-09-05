// Shared TypeScript types for the entire application

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: 'owner' | 'member';
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export enum UserRole {
  OWNER = 'owner',
  MEMBER = 'member'
}

export enum ChannelType {
  BAILEYS = 'baileys',
  WHATSAPP_BUSINESS = 'whatsapp_business'
}

export enum ChannelStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting'
}

export enum ConversationStatus {
  OPEN = 'open',
  ACTIVE = 'active',
  PENDING = 'pending',
  ARCHIVED = 'archived'
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker'
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum WorkflowTriggerEvent {
  MESSAGE_RECEIVED = 'message_received',
  CONTACT_CREATED = 'contact_created',
  TICKET_CREATED = 'ticket_created',
  TICKET_STATUS_CHANGED = 'ticket_status_changed'
}

export enum WorkflowActionType {
  CREATE_TICKET = 'create_ticket',
  ASSIGN_TICKET = 'assign_ticket',
  SEND_AUTO_REPLY = 'send_auto_reply',
  ADD_TAG = 'add_tag'
}

export interface WorkflowCondition {
  messageContains?: string;
  contactTag?: string;
  ticketPriority?: TicketPriority;
  [key: string]: any;
}

export interface WorkflowAction {
  actionType: WorkflowActionType;
  config: any;
}

export interface BaileysMessage {
  key: {
    id: string;
    remoteJid?: string;
    fromMe?: boolean;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      caption?: string;
      mimetype?: string;
    };
    videoMessage?: {
      caption?: string;
      mimetype?: string;
    };
    audioMessage?: {
      mimetype?: string;
    };
    documentMessage?: {
      caption?: string;
      mimetype?: string;
    };
    stickerMessage?: {
      mimetype?: string;
    };
  };
  pushName?: string;
  messageType?: string;
}

export interface BaileysEventHandlerPayload {
  tenantId: string;
  channelId: string;
  msg: BaileysMessage;
}

export interface QREventPayload {
  tenantId: string;
  channelId: string;
  qr: string;
}

export interface LidMappingPayload {
  tenantId: string;
  channelId: string;
  lid: string;
  jid: string;
}
