import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/withdrawals': {
        target: process.env.LOCAL_API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/data': {
        // The local editor needs this read-only endpoint for its catalogue.
        // Keep write endpoints local so localhost cannot accidentally change production data.
        target: 'https://backoffice-pixel.vercel.app',
        changeOrigin: true,
      },
      '/api/planner': {
        // Keep the local UI on the same shared data as the deployed app.
        target: 'https://backoffice-pixel.vercel.app',
        changeOrigin: true,
      },
      '/api/assignments': {
        // Assignments are shared with the deployed app, like the shared planner.
        target: 'https://backoffice-pixel.vercel.app',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.LOCAL_API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
