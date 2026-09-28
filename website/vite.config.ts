import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

const CLEAN_URLS: Record<string, string> = {
  '/features': '/features.html',
  '/features/': '/features.html',
};

const rewriteCleanUrls: Connect.NextHandleFunction = (request, _response, next) => {
  const path = request.url?.split('?')[0] ?? '';
  const target = CLEAN_URLS[path];
  if (target !== undefined) {
    request.url = target;
  }
  next();
};

const cleanUrls = (): Plugin => ({
  name: 'goodboy-clean-urls',
  configureServer: (server) => {
    server.middlewares.use(rewriteCleanUrls);
  },
  configurePreviewServer: (server) => {
    server.middlewares.use(rewriteCleanUrls);
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), cleanUrls()],
  server: {
    port: 1499,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(ROOT, 'index.html'),
        features: resolve(ROOT, 'features.html'),
      },
    },
  },
});
