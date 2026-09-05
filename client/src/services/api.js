import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('crm_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verify: () => api.get('/auth/verify'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const whatsappAPI = {
  getStatus: () => api.get('/whatsapp/status'),
  sync: () => api.post('/whatsapp/sync'),
};

export const channelsAPI = {
  getAll: () => api.get('/channels'),
  delete: (id) => api.delete(`/channels/${id}`),
};

export const conversationsAPI = {
  getAll: () => api.get('/conversations'),
  open: (payload) => api.post('/conversations/open', payload),
  delete: (id) => api.delete(`/conversations/${id}`),
};

export const contactsAPI = {
  getChatList: () => api.get('/contacts/chats'),
  getContacts: () => api.get('/contacts/contacts'),
  getGroups: () => api.get('/contacts/groups'),
  search: (q) => api.get(`/contacts/search?q=${q}`),
  update: (data) => api.post('/contacts', data),
  delete: (id) => api.delete(`/contacts/${id}`),
  addTag: (jid, tag, channelId) => api.post(`/contacts/${jid}/tags`, { tag, channelId }),
  updateNotes: (jid, notes, channelId) => api.put(`/contacts/${jid}/notes`, { notes, channelId }),
};

export const messagesAPI = {
  getMessages: (remoteJid, limit, before, channelId) =>
    api.get(`/messages/${remoteJid}`, { params: { limit, before, channelId } }),
  sendMessage: (remoteJid, content, options = {}) =>
    api.post('/messages/send', { remoteJid, content, ...options }),
};

export const billingAPI = {
  getPlans: () => api.get('/billing/plans'),
  getSubscription: () => api.get('/billing/subscription'),
  createCheckout: (data) => api.post('/billing/checkout', data),
  createPortal: () => api.post('/billing/portal'),
};

export default api;
