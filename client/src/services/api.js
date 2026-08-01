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
