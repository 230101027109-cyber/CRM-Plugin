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
  login: (pin) => api.post('/auth/login', { pin }),
  verify: () => api.get('/auth/verify'),
};

export const whatsappAPI = {
  getStatus: () => api.get('/whatsapp/status'),
  getQR: () => api.get('/whatsapp/qr'),
  connect: () => api.post('/whatsapp/connect'),
  disconnect: () => api.post('/whatsapp/disconnect'),
  sync: () => api.post('/whatsapp/sync'),
};

export const contactsAPI = {
  getChatList: () => api.get('/contacts/chats'),
  getContacts: () => api.get('/contacts/contacts'),
  getGroups: () => api.get('/contacts/groups'),
  search: (q) => api.get(`/contacts/search?q=${q}`),
  update: (data) => api.post('/contacts', data),
  addTag: (jid, tag) => api.post(`/contacts/${jid}/tags`, { tag }),
  updateNotes: (jid, notes) => api.put(`/contacts/${jid}/notes`, { notes }),
};

export const messagesAPI = {
  getMessages: (remoteJid, limit, before) =>
    api.get(`/messages/${remoteJid}`, { params: { limit, before } }),
  sendMessage: (remoteJid, content, options = {}) =>
    api.post('/messages/send', { remoteJid, content, ...options }),
};

export default api;
