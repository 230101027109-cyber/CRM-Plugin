// Application constants

export const DEFAULT_MAX_USERS = 3;
export const DEFAULT_PLAN = 'free';

export const JWT_EXPIRES_IN = '7d';

export const MAX_RETRY_ATTEMPTS = 5;
export const BACKOFF_MULTIPLIER = 1000;
export const MAX_BACKOFF_DELAY = 30000;

export const STORE_PATH = process.env.STORE_PATH || './data/baileys';

export const ALLOWED_MESSAGE_TYPES = ['text', 'image', 'video', 'audio', 'document', 'sticker'] as const;

export const USER_ROLES = ['owner', 'member'] as const;
export const CHANNEL_TYPES = ['baileys', 'whatsapp_business'] as const;
export const CHANNEL_STATUSES = ['connected', 'disconnected', 'connecting'] as const;
export const CONVERSATION_STATUSES = ['open', 'active', 'pending', 'archived'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const WORKFLOW_TRIGGER_EVENTS = [
  'message_received',
  'contact_created',
  'ticket_created',
  'ticket_status_changed'
] as const;
export const WORKFLOW_ACTION_TYPES = [
  'create_ticket',
  'assign_ticket',
  'send_auto_reply',
  'add_tag'
] as const;
