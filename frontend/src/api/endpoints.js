import { apiClient } from './client.js';

export const authApi = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }).then((r) => r.data),
  me: () => apiClient.get('/auth/me').then((r) => r.data),
};

export const bookApi = {
  myBooks: () => apiClient.get('/books/my-books').then((r) => r.data),
};

export const metaApi = {
  get: () => apiClient.get('/meta').then((r) => r.data),
};

export const ticketApi = {
  list: (params) => apiClient.get('/tickets', { params }).then((r) => r.data),
  get: (id) => apiClient.get(`/tickets/${id}`).then((r) => r.data),
  create: (payload) => apiClient.post('/tickets', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/tickets/${id}`, payload).then((r) => r.data),
  messages: (id) => apiClient.get(`/tickets/${id}/messages`).then((r) => r.data),
  addMessage: (id, payload) => apiClient.post(`/tickets/${id}/messages`, payload).then((r) => r.data),
  draft: (id, regenerate = false) =>
    apiClient.get(`/tickets/${id}/draft`, { params: { regenerate } }).then((r) => r.data),
};
