import axios from 'axios';

// In dev, Vite proxies /api to the local backend (see vite.config.js).
// In production, the frontend (Vercel) and backend (Render) live on different
// domains, so we point straight at the deployed API URL.
const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const client = axios.create({
  baseURL,
  withCredentials: true
});

export default client;
