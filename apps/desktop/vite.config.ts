import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Anchor paths to this file, not the process CWD, so building from the
// monorepo root (vite build -c apps/desktop/vite.config.ts) also works.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here('./renderer'),
  base: './',
  plugins: [react()],
  resolve: { alias: { '@renderer': here('./renderer') } },
  build: { outDir: here('./dist/renderer'), emptyOutDir: true }
});
