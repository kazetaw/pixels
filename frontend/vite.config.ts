import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://mcc102cb-3000.asse.devtunnels.ms',
        changeOrigin: true,
      },
    },
  },
});
