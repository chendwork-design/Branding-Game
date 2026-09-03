import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  cacheDir: '../../.vite-cache/web',
  server: { port: 4173, host: process.env.HOST ?? '127.0.0.1' },
  test: { exclude: ['e2e/**', 'node_modules/**'] },
  build: { emptyOutDir: false },
});
