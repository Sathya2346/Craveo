import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export const TOKEN_KEY = 'craveo:token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Normalises any axios failure into a message + field errors the UI can render. */
export const getApiError = (error) => {
  const payload = error?.response?.data?.error;
  if (!payload) {
    if (error?.code === 'ECONNABORTED') return { message: 'The request timed out. Please try again.', details: [] };
    if (!error?.response) return { message: 'Cannot reach the server. Check your connection.', details: [] };
    return { message: 'Something went wrong. Please try again.', details: [] };
  }
  return {
    message: payload.message || 'Something went wrong',
    code: payload.code,
    details: Array.isArray(payload.details) ? payload.details : [],
  };
};

/** Resolves a stored /uploads path (or absolute URL) to something the browser can load. */
export const assetUrl = (url) => {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
};

export default api;
