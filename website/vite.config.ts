import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cleanUrls } from './vite/cleanUrls';
import { readStarCount } from './vite/readStarCount';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), cleanUrls({ root: ROOT })],
  define: {
    __GOODBOY_STARS__: JSON.stringify(await readStarCount()),
  },
  server: {
    port: 1499,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(ROOT, 'index.html'),
        features: resolve(ROOT, 'features.html'),
        content: resolve(ROOT, 'content.html'),
      },
    },
  },
}));
