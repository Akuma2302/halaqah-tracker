import { io } from 'socket.io-client';
import { getToken } from './apiClient';

// Dev: same-origin via Vite proxy. Prod: frontend (Netlify) and backend (Render)
// are different origins, so connect straight to the deployed API URL.
const socketURL = import.meta.env.VITE_API_URL || undefined;

// `auth` as a function is called fresh on every connect/reconnect, so it
// always picks up the current token from storage rather than a stale one
// captured at import time.
const socket = io(socketURL, {
  autoConnect: false,
  auth: (cb) => cb({ token: getToken() })
});

export default socket;
