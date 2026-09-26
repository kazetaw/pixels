import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/planner': {
        // Keep the local UI on the same shared data as the deployed app.
        target: 'https://backoffice-pixel.vercel.app',
        changeOrigin: true,
      },
    },
  },
});
