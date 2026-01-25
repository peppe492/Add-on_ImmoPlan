import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '', // Usiamo stringa vuota per forzare percorsi relativi ovunque
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: false,
    modulePreload: {
      polyfill: false
    },
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
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