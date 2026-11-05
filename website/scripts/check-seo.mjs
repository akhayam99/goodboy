import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSeo } from './lib/seoCheck.mjs';

const ROOT = process.env.CHECK_SEO_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const PUBLISHED = resolve(ROOT, 'scripts/seo-published-paths.json');
const IS_STRICT = process.argv.includes('--strict');

const walk = ({ dir }) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk({ dir: full }) : [full];
  });

const readJson = ({ path, fallback }) =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;

const originOf = () => {
  const match = /origin:\s*'([^']+)'/.exec(readFileSync(resolve(ROOT, 'src/lib/site.ts'), 'utf8'));
  if (match === null) {
    throw new Error('src/lib/site.ts has no origin');
  }
  return match[1];
};

const main = () => {
  if (!existsSync(DIST)) {
    console.error('check-seo: no dist/, run pnpm build first');
    return 1;
  }
  const files = walk({ dir: DIST }).map((path) => relative(DIST, path).split(sep).join('/'));
  const htmlFiles = new Map(
    files
      .filter((file) => file.endsWith('.html'))
      .map((file) => [file, readFileSync(join(DIST, file), 'utf8')]),
  );
  const cssFiles = new Map(
    files
      .filter((file) => file.endsWith('.css'))
      .map((file) => [file, readFileSync(join(DIST, file), 'utf8')]),
  );
  const issues = checkSeo({
    htmlFiles,
    cssFiles,
    distFiles: new Set(files),
    sitemap: readFileSync(join(DIST, 'sitemap.xml'), 'utf8'),
    llms: readFileSync(join(DIST, 'llms.txt'), 'utf8'),
    feed: readFileSync(join(DIST, 'changelog.xml'), 'utf8'),
    redirects: readJson({ path: resolve(ROOT, 'vercel.json'), fallback: {} }).redirects ?? [],
    published: readJson({ path: PUBLISHED, fallback: [] }),
    trackSpec: readJson({ path: resolve(ROOT, 'src/lib/trackEvents.json'), fallback: {} }),
    origin: originOf(),
  });
  const errors = issues.filter(({ severity }) => severity === 'error');
  const warnings = issues.filter(({ severity }) => severity === 'warning');
  const blocking = IS_STRICT ? issues : errors;
  const reportWarning = IS_STRICT ? console.error : console.warn;
  warnings.forEach((found) => {
    reportWarning(`check-seo: warning ${found.rule} ${found.file}: ${found.message}`);
  });
  errors.forEach((found) => {
    console.error(`check-seo: error ${found.rule} ${found.file}: ${found.message}`);
  });
  if (blocking.length === 0) {
    console.log(`check-seo ok: ${htmlFiles.size} pages`);
  }
  return blocking.length > 0 ? 1 : 0;
};

process.exit(main());
