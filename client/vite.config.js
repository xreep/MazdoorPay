import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5055', changeOrigin: true },
    },
  },
  // The production build served locally (used by the end-to-end tests) talks to the same API.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:5055', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
