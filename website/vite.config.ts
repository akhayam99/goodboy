import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const REPO_API = 'https://api.github.com/repos/akhayam99/goodboy';
const STAR_FETCH_TIMEOUT_MS = 5000;

const fetchStarCount = async (): Promise<number | null> => {
  try {
    const response = await fetch(REPO_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(STAR_FETCH_TIMEOUT_MS),
    });
    const payload: unknown = response.ok ? await response.json() : null;
    const count = (payload as { readonly stargazers_count?: unknown } | null)?.stargazers_count;
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
};

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

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), cleanUrls()],
  define: {
    __GOODBOY_STARS__: JSON.stringify(await fetchStarCount()),
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
      },
    },
  },
}));
