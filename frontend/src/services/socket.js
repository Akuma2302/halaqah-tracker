import { io } from 'socket.io-client';

// Dev: same-origin via Vite proxy. Prod: frontend (Vercel) and backend (Render)
// are different origins, so connect straight to the deployed API URL.
const socketURL = import.meta.env.VITE_API_URL || undefined;

const socket = io(socketURL, { autoConnect: false, withCredentials: true });

export default socket;
