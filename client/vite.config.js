import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The end-to-end tests point the preview at their own throwaway API, never at one you run.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:5055';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  // The production build served locally (used by the end-to-end tests) talks to the same API.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
