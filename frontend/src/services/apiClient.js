import axios from 'axios';

// In dev, Vite proxies /api to the local backend (see vite.config.js).
// In production, the frontend (Netlify) and backend (Render) live on different
// domains, so we point straight at the deployed API URL.
const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const TOKEN_KEY = 'mutabaah_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const client = axios.create({ baseURL });

// Auth via Bearer token instead of cookies — cookies set across the
// Netlify/Render domain split get silently blocked by iOS Safari's
// cross-site cookie policy (ITP) regardless of SameSite settings. A token in
// the Authorization header isn't a cookie, so none of those rules apply.
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default client;
