import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('bookleaf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bookleaf_token');
      localStorage.removeItem('bookleaf_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Normalizes our backend's { error: { code, message, details } } shape into
// a plain string so components don't need to know the error envelope.
export function extractErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err.response?.data?.error?.message ?? fallback;
}
