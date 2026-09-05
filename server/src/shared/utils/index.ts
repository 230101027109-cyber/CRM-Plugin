import { v4 as uuidv4 } from 'uuid';

export const generateConversationKey = (channelId: string, contactJid: string): string => {
  return `${channelId}:${contactJid}`;
};

export const generateId = (): string => {
  return uuidv4();
};

export const sanitizePhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
