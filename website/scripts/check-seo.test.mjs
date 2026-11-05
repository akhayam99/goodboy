import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  RULES,
  baselineOf,
  checkSeo,
  countsOf,
  growthLines,
  pathOfFile,
  staleLines,
} from './lib/seoCheck.mjs';
import { tagsOf } from './lib/seoHtml.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://acme.test';
const TITLE = 'Acme: a tool for running agents on one task';
const DESCRIPTION =
  'Acme runs several coding agents on one task, with a git worktree per branch, shared context and a review step before anything merges.';

const TRACK_SPEC = {
  star_click: { cta_location: ['hero', 'install'] },
  download_click: { app_version: { pattern: '^\\d+\\.\\d+\\.\\d+$' } },
};

const graph = ({ extra = [] } = {}) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'Acme' },
      {
        '@type': 'WebPage',
        '@id': `${ORIGIN}/#webpage`,
        isPartOf: { '@id': `${ORIGIN}/#organization` },
      },
      ...extra,
    ],
  });

const page = ({
  title = TITLE,
  description = DESCRIPTION,
  path = '/',
  canonical,
  robots = '',
  ld = graph(),
  body = '<h1>Acme</h1><h2>Parts</h2>',
  head = '',
} = {}) => {
  const url = `${ORIGIN}${path}`;
  return [
    '<!doctype html><html><head>',
    title === null ? '' : `<title>${title}</title>`,
    description === null ? '' : `<meta name="description" content="${description}" />`,
    robots === ''
      ? `<link rel="canonical" href="${canonical ?? url}" />`
      : `<meta name="robots" content="${robots}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${ORIGIN}/og.png" />`,
    `<script type="application/ld+json">${ld}</script>`,
    head,
    `</head><body>${body}</body></html>`,
  ].join('\n');
};

const run = ({
  htmlFiles = { 'index.html': page() },
  sitemapPaths = ['/'],
  distFiles = [],
  redirects = [],
  published = [],
  trackSpec = TRACK_SPEC,
  llmsPaths = sitemapPaths.filter((path) => !path.startsWith('/changelog/')),
  feedPaths = sitemapPaths.filter((path) => path.startsWith('/changelog/')),
} = {}) =>
  checkSeo({
    htmlFiles: new Map(Object.entries(htmlFiles)),
    distFiles: new Set([...Object.keys(htmlFiles), ...distFiles]),
    sitemap: sitemapPaths.map((path) => `<url><loc>${ORIGIN}${path}</loc></url>`).join(''),
    llms: llmsPaths.map((path) => `- [x](${ORIGIN}${path}): y`).join('\n'),
    feed: [
      `<id>${ORIGIN}/changelog.xml</id>`,
      ...feedPaths.map((path) => `<id>${ORIGIN}${path}</id>`),
    ].join('\n'),
    redirects,
    published,
    trackSpec,
    origin: ORIGIN,
  });

const rulesOf = (issues) => [...new Set(issues.map(({ rule }) => rule))].sort();

describe('tagsOf', () => {
  it('reads attributes, skips comments and keeps script bodies whole', () => {
    const tags = tagsOf({
      html: '<!-- <a href="/no"> --><a href="/yes" class="x y">t</a><script>if (a < b) { x = "<a>"; }</script><img alt="" src="/i.png"/>',
    });
    const anchors = tags.filter((tag) => tag.name === 'a' && !tag.isClosing);
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0].attributes.get('href'), '/yes');
    assert.equal(tags.find((tag) => tag.name === 'script').body, 'if (a < b) { x = "<a>"; }');
    assert.equal(tags.find((tag) => tag.name === 'img').attributes.get('alt'), '');
  });

  it('keeps a quoted greater-than inside an attribute', () => {
    const [tag] = tagsOf({ html: '<meta content="a > b" name="x">' });
    assert.equal(tag.attributes.get('content'), 'a > b');
  });
});

describe('pathOfFile', () => {
  it('maps a built file to its url path', () => {
    assert.equal(pathOfFile({ file: 'index.html' }), '/');
    assert.equal(pathOfFile({ file: 'docs/setup.html' }), '/docs/setup');
  });
});

describe('checkSeo', () => {
  it('passes a valid page', () => {
    assert.deepEqual(run(), []);
  });

  it('fails a missing title and a missing description', () => {
    const issues = run({ htmlFiles: { 'index.html': page({ title: null, description: null }) } });
    assert.ok(rulesOf(issues).includes('title-missing'));
    assert.ok(rulesOf(issues).includes('description-missing'));
  });

  it('fails a title or a description shared by two pages', () => {
    const issues = run({
      htmlFiles: { 'index.html': page(), 'docs.html': page({ path: '/docs' }) },
      sitemapPaths: ['/', '/docs'],
    });
    assert.deepEqual(rulesOf(issues), ['description-duplicate', 'title-duplicate']);
  });

  it('fails two h1 elements and a skipped heading level', () => {
    const two = run({ htmlFiles: { 'index.html': page({ body: '<h1>A</h1><h1>B</h1>' }) } });
    assert.deepEqual(rulesOf(two), ['h1-count']);
    const skip = run({ htmlFiles: { 'index.html': page({ body: '<h1>A</h1><h3>B</h3>' }) } });
    assert.deepEqual(rulesOf(skip), ['heading-skip']);
  });

  it('fails a canonical that is not the page url, or a page missing from the sitemap', () => {
    const wrong = run({ htmlFiles: { 'index.html': page({ canonical: `${ORIGIN}/other` }) } });
    assert.deepEqual(rulesOf(wrong), ['canonical-mismatch']);
    const absent = run({ sitemapPaths: [] });
    assert.deepEqual(rulesOf(absent), ['canonical-not-in-sitemap', 'sitemap-missing-page']);
  });

  it('keeps a noindex page out of the sitemap', () => {
    const noindex = page({ robots: 'noindex', path: '/404' });
    const clean = run({
      htmlFiles: { 'index.html': page(), '404.html': noindex },
      sitemapPaths: ['/'],
    });
    assert.ok(!rulesOf(clean).includes('noindex-in-sitemap'));
    const listed = run({
      htmlFiles: { 'index.html': page(), '404.html': noindex },
      sitemapPaths: ['/', '/404'],
    });
    assert.ok(rulesOf(listed).includes('noindex-in-sitemap'));
  });

  it('fails a sitemap url with no indexed page', () => {
    assert.deepEqual(rulesOf(run({ sitemapPaths: ['/', '/gone'] })), ['sitemap-unknown-page']);
  });

  it('fails a page missing from llms.txt, a llms.txt url with no page, and a feed that disagrees', () => {
    const pages = {
      'index.html': page(),
      'docs.html': page({
        path: '/docs',
        title: TITLE + ' docs',
        description: DESCRIPTION + ' Docs.',
      }),
      'changelog/1.0.0.html': page({
        path: '/changelog/1.0.0',
        title: TITLE + ' one',
        description: DESCRIPTION + ' One.',
        ld: graph({ extra: [{ '@type': 'WebPage', '@id': 'z', datePublished: '2026-11-05' }] }),
      }),
    };
    const sitemapPaths = ['/', '/docs', '/changelog/1.0.0'];
    assert.deepEqual(rulesOf(run({ htmlFiles: pages, sitemapPaths })), []);
    assert.deepEqual(rulesOf(run({ htmlFiles: pages, sitemapPaths, llmsPaths: ['/'] })), [
      'llms-missing-page',
    ]);
    assert.deepEqual(
      rulesOf(run({ htmlFiles: pages, sitemapPaths, llmsPaths: ['/', '/docs', '/gone'] })),
      ['llms-unknown-page'],
    );
    assert.deepEqual(rulesOf(run({ htmlFiles: pages, sitemapPaths, feedPaths: [] })), [
      'feed-mismatch',
    ]);
    assert.deepEqual(
      rulesOf(
        run({
          htmlFiles: pages,
          sitemapPaths,
          feedPaths: ['/changelog/1.0.0', '/changelog/0.9.0'],
        }),
      ),
      ['feed-mismatch'],
    );
  });

  it('fails an image with no alt, an empty alt or no size', () => {
    const body = (img) => `<h1>A</h1>${img}`;
    const alt = run({
      htmlFiles: { 'index.html': page({ body: body('<img src="/a.png" width="1" height="1">') }) },
    });
    assert.deepEqual(rulesOf(alt), ['img-alt']);
    const empty = run({
      htmlFiles: {
        'index.html': page({ body: body('<img src="/a.png" alt="" width="1" height="1">') }),
      },
    });
    assert.deepEqual(rulesOf(empty), ['img-alt']);
    const size = run({
      htmlFiles: { 'index.html': page({ body: body('<img src="/a.png" alt="a">') }) },
    });
    assert.deepEqual(rulesOf(size), ['img-size']);
    assert.match(size[0].message, /node scripts\/sync-image-sizes\.mjs/);
    const ok = run({
      htmlFiles: {
        'index.html': page({ body: body('<img src="/a.png" alt="a" width="2" height="1">') }),
      },
    });
    assert.deepEqual(ok, []);
  });

  it('fails invalid JSON-LD, a type outside the list and a dangling @id', () => {
    const invalid = run({ htmlFiles: { 'index.html': page({ ld: '{nope' }) } });
    assert.deepEqual(rulesOf(invalid), ['jsonld-invalid']);
    const type = run({
      htmlFiles: {
        'index.html': page({ ld: graph({ extra: [{ '@type': 'Physician', '@id': 'x' }] }) }),
      },
    });
    assert.deepEqual(rulesOf(type), ['jsonld-type']);
    const ref = run({
      htmlFiles: {
        'index.html': page({
          ld: graph({ extra: [{ '@type': 'WebSite', about: { '@id': `${ORIGIN}/#missing` } }] }),
        }),
      },
    });
    assert.deepEqual(rulesOf(ref), ['jsonld-ref']);
  });

  it('wants a TechArticle on a doc and a datePublished on a release', () => {
    const doc = (ld) =>
      run({
        htmlFiles: {
          'index.html': page(),
          'docs/a.html': page({
            path: '/docs/a',
            ld,
            title: TITLE + ' a',
            description: DESCRIPTION + ' A.',
          }),
        },
        sitemapPaths: ['/', '/docs/a'],
      });
    assert.deepEqual(rulesOf(doc(graph())), ['jsonld-page-kind']);
    assert.deepEqual(rulesOf(doc(graph({ extra: [{ '@type': 'TechArticle', '@id': 'x' }] }))), []);
    const release = (ld) =>
      run({
        htmlFiles: {
          'index.html': page(),
          'changelog/1.0.0.html': page({
            path: '/changelog/1.0.0',
            ld,
            title: TITLE + ' r',
            description: DESCRIPTION + ' R.',
          }),
        },
        sitemapPaths: ['/', '/changelog/1.0.0'],
      });
    assert.deepEqual(rulesOf(release(graph())), ['jsonld-page-kind']);
    assert.deepEqual(
      rulesOf(
        release(
          graph({ extra: [{ '@type': 'WebPage', '@id': 'y', datePublished: '2026-11-05' }] }),
        ),
      ),
      [],
    );
  });

  it('fails a broken internal link and a link to a redirect source', () => {
    const body = (href) => `<h1>A</h1><a href="${href}">x</a>`;
    const broken = run({ htmlFiles: { 'index.html': page({ body: body('/nope#x') }) } });
    assert.deepEqual(rulesOf(broken), ['link-broken']);
    const ok = run({
      htmlFiles: { 'index.html': page({ body: body('/docs/a#x') }) },
      distFiles: ['docs/a.html'],
    });
    assert.deepEqual(ok, []);
    const redirect = run({
      htmlFiles: { 'index.html': page({ body: body('/old') }) },
      distFiles: ['new.html'],
      redirects: [{ source: '/old', destination: '/new' }],
    });
    assert.deepEqual(rulesOf(redirect), ['link-to-redirect']);
  });

  it('fails a redirect chain and a redirect to a page that is not built', () => {
    const chain = run({
      redirects: [
        { source: '/a', destination: '/b' },
        { source: '/b', destination: '/' },
      ],
    });
    assert.deepEqual(rulesOf(chain), ['redirect-chain']);
    const dead = run({ redirects: [{ source: '/a', destination: '/gone' }] });
    assert.deepEqual(rulesOf(dead), ['redirect-dead']);
  });

  it('fails a published path that is neither built nor redirected', () => {
    assert.deepEqual(rulesOf(run({ published: ['/', '/docs/old'] })), ['published-missing']);
    assert.deepEqual(
      run({ published: ['/docs/old'], redirects: [{ source: '/docs/old', destination: '/' }] }),
      [],
    );
  });

  it('fails a Tag Manager id that appears twice or comes before the consent default', () => {
    const consent = "gtag('consent', 'default', {});";
    const loader = (id) => `<script>load('${id}')</script>`;
    const twice = run({
      htmlFiles: {
        'index.html': page({
          head: `<script>${consent}</script>${loader('GTM-5NM3VX7Q')}${loader('GTM-5NM3VX7Q')}`,
        }),
      },
    });
    assert.deepEqual(rulesOf(twice), ['gtm-count']);
    const early = run({
      htmlFiles: {
        'index.html': page({ head: `${loader('GTM-5NM3VX7Q')}<script>${consent}</script>` }),
      },
    });
    assert.deepEqual(rulesOf(early), ['consent-order']);
    const ok = run({
      htmlFiles: {
        'index.html': page({ head: `<script>${consent}</script>${loader('GTM-5NM3VX7Q')}` }),
      },
    });
    assert.deepEqual(ok, []);
  });

  it('fails an iubenda script that comes before the consent default or the preference handler', () => {
    const consent = "<script>gtag('consent', 'default', {});</script>";
    const handler = '<script>consent.onPreference = function () {};</script>';
    const iubenda = '<script src="https://cdn.iubenda.com/cs/iubenda_cs.js" async></script>';
    const check = (head) => run({ htmlFiles: { 'index.html': page({ head }) } });
    assert.deepEqual(check(`${consent}${handler}${iubenda}`), []);
    const early = check(`${consent}${iubenda}${handler}`);
    assert.deepEqual(rulesOf(early), ['consent-order']);
    assert.match(early[0].message, /handler/);
    assert.deepEqual(rulesOf(check(`${consent}${iubenda}`)), ['consent-order']);
    const unguarded = check(`${handler}${iubenda}${consent}`);
    assert.deepEqual(rulesOf(unguarded), ['consent-order']);
    assert.match(unguarded[0].message, /default/);
  });

  it('fails a Google tag, frame or image in the static html', () => {
    const issues = run({
      htmlFiles: {
        'index.html': page({
          head: '<script async src="https://www.googletagmanager.com/gtm.js?id=X"></script>',
          body: '<h1>A</h1><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=X"></iframe></noscript>',
        }),
      },
    });
    assert.deepEqual(rulesOf(issues), ['google-before-consent']);
    assert.equal(issues.length, 2);
  });

  it('fails a data-track event or parameter that the spec does not list', () => {
    const link = (attributes) => ({
      'index.html': page({ body: `<h1>A</h1><a href="https://x.test" ${attributes}>x</a>` }),
    });
    const rules = (attributes) => rulesOf(run({ htmlFiles: link(attributes) }));
    assert.deepEqual(rules('data-track="star_click" data-track-cta-location="hero"'), []);
    assert.deepEqual(rules('data-track="menu_click"'), ['track-invalid']);
    assert.deepEqual(rules('data-track="star_click" data-track-cta-location="footer"'), [
      'track-invalid',
    ]);
    assert.deepEqual(rules('data-track="star_click"'), ['track-invalid']);
    assert.deepEqual(
      rules('data-track="star_click" data-track-cta-location="hero" data-track-text="x"'),
      ['track-invalid'],
    );
    assert.deepEqual(rules('data-track="download_click" data-track-app-version="0.31.10"'), []);
    assert.deepEqual(rules('data-track="download_click" data-track-app-version="latest"'), [
      'track-invalid',
    ]);
    assert.deepEqual(rules('data-track="constructor"'), ['track-invalid']);
  });

  it('fails a download or star link that carries no data-track', () => {
    const html = {
      'index.html': page({ body: '<h1>A</h1><a href="https://x.test" data-download>x</a>' }),
    };
    assert.deepEqual(rulesOf(run({ htmlFiles: html })), ['track-missing']);
  });

  it('warns on a title or description length, and never fails on it', () => {
    const issues = run({
      htmlFiles: { 'index.html': page({ title: 'Acme', description: 'Short one.' }) },
    });
    assert.deepEqual(rulesOf(issues), ['description-length', 'title-length']);
    assert.ok(issues.every(({ severity }) => severity === 'warning'));
  });
});

describe('baseline ratchet', () => {
  const issues = run({
    htmlFiles: { 'index.html': page({ title: 'Acme', body: '<h1>A</h1><h1>B</h1>' }) },
  });

  it('counts per rule and file, split by severity', () => {
    assert.deepEqual(countsOf({ issues, severity: 'error' }), { 'h1-count': { 'index.html': 1 } });
    assert.deepEqual(countsOf({ issues, severity: 'warning' }), {
      'title-length': { 'index.html': 1 },
    });
  });

  it('fails a count that grows past the baseline and stays quiet below it', () => {
    const counts = countsOf({ issues, severity: 'error' });
    assert.equal(growthLines({ counts, baseline: {} }).length, 1);
    assert.equal(growthLines({ counts, baseline: { 'h1-count': { 'index.html': 1 } } }).length, 0);
    assert.equal(growthLines({ counts, baseline: { 'h1-count': { 'index.html': 4 } } }).length, 0);
  });

  it('reports a baseline row above the measured count', () => {
    const counts = countsOf({ issues, severity: 'error' });
    assert.equal(staleLines({ counts, baseline: { 'h1-count': { 'index.html': 4 } } }).length, 1);
    assert.equal(staleLines({ counts, baseline: { 'h1-count': { 'index.html': 1 } } }).length, 0);
  });

  it('writes the same shape it reads', () => {
    const counts = countsOf({ issues, severity: 'error' });
    assert.deepEqual(baselineOf({ counts }), counts);
  });
});

describe('committed baselines', () => {
  const read = (name) => JSON.parse(readFileSync(join(HERE, name), 'utf8'));

  it('hold each rule in the file of its severity, with positive counts', () => {
    [
      ['seo-errors.baseline.json', 'error'],
      ['seo-warnings.baseline.json', 'warning'],
    ].forEach(([name, severity]) => {
      Object.entries(read(name)).forEach(([rule, byFile]) => {
        assert.equal(RULES[rule], severity, `${rule} belongs in the ${RULES[rule]} baseline`);
        Object.values(byFile).forEach((count) => assert.ok(count > 0));
      });
    });
  });

  it('lists published paths from the root, sorted and unique', () => {
    const paths = read('seo-published-paths.json');
    assert.ok(paths.includes('/'));
    assert.deepEqual(paths, [...new Set(paths)].sort());
    paths.forEach((path) => assert.ok(path.startsWith('/')));
  });
});
