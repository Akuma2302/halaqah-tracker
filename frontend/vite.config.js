import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Set DEV_PROXY_TARGET in .env to proxy to a remote backend (e.g. Render) instead of a local one.
  const target = loadEnv(mode, process.cwd(), '').DEV_PROXY_TARGET || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/socket.io': { target, ws: true, changeOrigin: true }
      }
    }
  };
});
