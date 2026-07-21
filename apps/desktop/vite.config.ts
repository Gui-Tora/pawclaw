import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: 'renderer',
  base: './',
  plugins: [react()],
  resolve: { alias: { '@renderer': fileURLToPath(new URL('./renderer', import.meta.url)) } },
  build: { outDir: '../dist/renderer', emptyOutDir: true }
});
