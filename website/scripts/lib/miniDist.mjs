import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = resolve(HERE, '..', 'check-seo.mjs');
export const ORIGIN = 'https://acme.test';

const graph = ({ date }) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'Acme' },
      {
        '@type': 'WebPage',
        '@id': `${ORIGIN}/#webpage`,
        isPartOf: { '@id': `${ORIGIN}/#organization` },
        ...(date === undefined ? {} : { datePublished: date }),
      },
    ],
  });

export const pageHtml = ({ path, title, description, date }) =>
  [
    '<!doctype html><html><head>',
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${ORIGIN}${path}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${ORIGIN}${path}" />`,
    `<meta property="og:image" content="${ORIGIN}/og.png" />`,
    `<script type="application/ld+json">${graph({ date })}</script>`,
    '</head><body><h1>Acme</h1><h2>Parts</h2></body></html>',
  ].join('\n');

export const runCheckSeo = ({ pages, args = [] }) => {
  const root = mkdtempSync(join(tmpdir(), 'check-seo-'));
  try {
    mkdirSync(join(root, 'dist', 'changelog'), { recursive: true });
    mkdirSync(join(root, 'src', 'lib'), { recursive: true });
    writeFileSync(join(root, 'src', 'lib', 'site.ts'), `origin: '${ORIGIN}'\n`);
    const paths = pages.map(({ path }) => path);
    pages.forEach((page) => {
      const file = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
      writeFileSync(join(root, 'dist', file), pageHtml(page));
    });
    writeFileSync(
      join(root, 'dist', 'sitemap.xml'),
      paths.map((path) => `<url><loc>${ORIGIN}${path}</loc></url>`).join(''),
    );
    writeFileSync(
      join(root, 'dist', 'llms.txt'),
      paths
        .filter((path) => !path.startsWith('/changelog/'))
        .map((path) => `- [x](${ORIGIN}${path}): y`)
        .join('\n'),
    );
    writeFileSync(
      join(root, 'dist', 'changelog.xml'),
      [
        `<id>${ORIGIN}/changelog.xml</id>`,
        ...paths.filter((path) => path.startsWith('/changelog/')).map((path) => `<id>${ORIGIN}${path}</id>`),
      ].join('\n'),
    );
    const result = spawnSync(process.execPath, [CHECK, ...args], {
      env: { ...process.env, CHECK_SEO_ROOT: root },
      encoding: 'utf8',
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};
