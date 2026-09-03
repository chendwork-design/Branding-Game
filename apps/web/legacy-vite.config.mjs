import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: '../../.vite-cache/web-dist',
    emptyOutDir: false,
    target: 'es2017',
    lib: {
      entry: 'src/legacy-main.tsx',
      name: 'LaojieLegacy',
      formats: ['iife'],
      fileName: () => 'legacy-bundle.js',
      cssFileName: 'legacy-app',
    },
  },
});
