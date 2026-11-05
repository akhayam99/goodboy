import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baselineOf, checkSeo, countsOf, growthLines, staleLines } from './lib/seoCheck.mjs';

const ROOT = process.env.CHECK_SEO_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const BASELINES = {
  error: resolve(ROOT, 'scripts/seo-errors.baseline.json'),
  warning: resolve(ROOT, 'scripts/seo-warnings.baseline.json'),
};
const PUBLISHED = resolve(ROOT, 'scripts/seo-published-paths.json');
const IS_WRITE = process.argv.includes('--write');
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
  let isFailed = false;
  Object.entries(BASELINES).forEach(([severity, path]) => {
    const counts = countsOf({ issues, severity });
    const baseline = readJson({ path, fallback: {} });
    const growth = growthLines({ counts, baseline });
    const stale = staleLines({ counts, baseline });
    if (IS_WRITE && (growth.length === 0 || !existsSync(path))) {
      writeFileSync(path, `${JSON.stringify(baselineOf({ counts }), null, 2)}\n`);
      console.log(`check-seo: wrote ${relative(ROOT, path)}`);
      return;
    }
    if (growth.length > 0) {
      const isBlocking = severity === 'error' || IS_STRICT;
      isFailed = isFailed || isBlocking;
      const report = isBlocking ? console.error : console.warn;
      const rules = new Set(growth.map((line) => line.trim().split(' ')[1]));
      report(
        `check-seo: ${severity}s grew past ${relative(ROOT, path)}:\n${growth.slice(0, 15).join('\n')}${growth.length > 15 ? `\n  ... ${growth.length - 15} more` : ''}`,
      );
      issues
        .filter((found) => found.severity === severity && rules.has(found.rule))
        .slice(0, 15)
        .forEach((found) => report(`    ${found.rule} ${found.file}: ${found.message}`));
    }
    if (stale.length > 0) {
      console.warn(
        `check-seo: ${relative(ROOT, path)} is above the measured count, run node scripts/check-seo.mjs --write:\n${stale.join('\n')}`,
      );
    }
  });
  if (!isFailed) {
    console.log(`check-seo ok: ${htmlFiles.size} pages`);
  }
  return isFailed ? 1 : 0;
};

process.exit(main());
