import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('crm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('crm_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data: Record<string, string>) => api.post('/auth/register', data),
  login: (data: { email: string; pin: string }) => api.post('/auth/login', data),
  verify: () => api.get('/auth/verify'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: Record<string, string>) => api.put('/auth/profile', data),
};

export const whatsappAPI = {
  getStatus: () => api.get('/whatsapp/status'),
  sync: () => api.post('/whatsapp/sync'),
};

export const channelsAPI = {
  getAll: () => api.get('/channels'),
  delete: (id: string) => api.delete(`/channels/${id}`),
};

export const conversationsAPI = {
  getAll: () => api.get('/conversations'),
  open: (payload: Record<string, any>) => api.post('/conversations/open', payload),
  delete: (id: string) => api.delete(`/conversations/${id}`),
};

export const contactsAPI = {
  getChatList: () => api.get('/contacts/chats'),
  getContacts: () => api.get('/contacts/contacts'),
  getGroups: () => api.get('/contacts/groups'),
  search: (q: string) => api.get(`/contacts/search?q=${q}`),
  update: (data: Record<string, any>) => api.post('/contacts', data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  addTag: (jid: string, tag: string, channelId: string) => api.post(`/contacts/${jid}/tags`, { tag, channelId }),
  updateNotes: (jid: string, notes: string, channelId: string) => api.put(`/contacts/${jid}/notes`, { notes, channelId }),
};

export const messagesAPI = {
  getMessages: (remoteJid: string, limit: number, before?: string, channelId?: string) =>
    api.get(`/messages/${remoteJid}`, { params: { limit, before, channelId } }),
  sendMessage: (remoteJid: string, content: string, options: Record<string, any> = {}) =>
    api.post('/messages/send', { remoteJid, content, ...options }),
};

export default api;
