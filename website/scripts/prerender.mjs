import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const SSR_DIST = resolve(ROOT, 'node_modules/.cache/goodboy-ssr');
const SSR_ENTRY = resolve(ROOT, 'src/server/renderSite.tsx');
const TEMPLATES = {
  home: 'index.html',
  features: 'features.html',
  content: 'content.html',
};

const readTemplates = () =>
  Object.fromEntries(
    Object.entries(TEMPLATES).map(([key, file]) => [
      key,
      readFileSync(resolve(DIST, file), 'utf8'),
    ]),
  );

const main = async () => {
  await build({ root: ROOT });
  await build({
    root: ROOT,
    logLevel: 'warn',
    build: {
      ssr: true,
      outDir: SSR_DIST,
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: { input: SSR_ENTRY },
    },
  });
  const { renderSite } = await import(pathToFileURL(resolve(SSR_DIST, 'renderSite.js')).href);
  const files = renderSite({ templates: readTemplates() });
  rmSync(resolve(DIST, TEMPLATES.content));
  files.forEach(({ path, content }) => {
    const target = resolve(DIST, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  });
  rmSync(SSR_DIST, { recursive: true, force: true });
  console.log(`prerender ok: ${files.length} files`);
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
