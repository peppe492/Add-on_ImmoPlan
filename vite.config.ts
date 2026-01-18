
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: base: './' permette all'app di funzionare in sottocartelle (HA Ingress)
  base: './',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9301',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
