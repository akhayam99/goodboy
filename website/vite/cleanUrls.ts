import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Connect, Plugin } from 'vite';

type Params = {
  readonly root: string;
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

const buildRewriteBuiltPages =
  ({ root }: Params): Connect.NextHandleFunction =>
  (request, _response, next) => {
    const path = (request.url?.split('?')[0] ?? '').replace(/\/$/, '');
    const target = `${path}.html`;
    if (path !== '' && existsSync(resolve(root, 'dist', `.${target}`))) {
      request.url = target;
    }
    next();
  };

export const cleanUrls = ({ root }: Params): Plugin => ({
  name: 'goodboy-clean-urls',
  configureServer: (server) => {
    server.middlewares.use(rewriteCleanUrls);
  },
  configurePreviewServer: (server) => {
    server.middlewares.use(buildRewriteBuiltPages({ root }));
  },
});
