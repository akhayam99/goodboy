import { decodeAttribute, tagsOf, textOf } from './seoHtml.mjs';

export const GTM_ID = 'GTM-5NM3VX7Q';
export const TITLE_RANGE = { min: 30, max: 70 };
export const DESCRIPTION_RANGE = { min: 70, max: 160 };

export const ALLOWED_TYPES = new Set([
  'Organization',
  'WebSite',
  'SoftwareApplication',
  'WebPage',
  'CollectionPage',
  'TechArticle',
  'BreadcrumbList',
  'ImageObject',
  'Offer',
  'Person',
  'ListItem',
]);

export const RULES = {
  'title-missing': 'error',
  'description-missing': 'error',
  'title-duplicate': 'error',
  'description-duplicate': 'error',
  'h1-count': 'error',
  'heading-skip': 'error',
  'canonical-mismatch': 'error',
  'canonical-not-in-sitemap': 'error',
  'noindex-in-sitemap': 'error',
  'sitemap-missing-page': 'error',
  'sitemap-unknown-page': 'error',
  'llms-missing-page': 'error',
  'llms-unknown-page': 'error',
  'feed-mismatch': 'error',
  'og-missing': 'error',
  'img-alt': 'error',
  'img-size': 'error',
  'jsonld-invalid': 'error',
  'jsonld-type': 'error',
  'jsonld-ref': 'error',
  'link-broken': 'error',
  'link-to-redirect': 'error',
  'redirect-chain': 'error',
  'redirect-dead': 'error',
  'published-missing': 'error',
  'gtm-count': 'error',
  'consent-order': 'error',
  'title-length': 'warning',
  'description-length': 'warning',
};

export const pathOfFile = ({ file }) => {
  if (file === 'index.html') {
    return '/';
  }
  return `/${file.replace(/\.html$/, '')}`;
};

const metaOf = ({ tags, key, value }) =>
  tags.find((tag) => tag.name === 'meta' && tag.attributes.get(key) === value);

const contentOf = ({ tag }) =>
  tag === undefined ? '' : decodeAttribute({ text: tag.attributes.get('content') ?? '' }).trim();

const issue = ({ rule, file, message }) => ({ rule, severity: RULES[rule], file, message });

const pageFacts = ({ file, html }) => {
  const tags = tagsOf({ html });
  const titleTag = tags.find((tag) => tag.name === 'title' && !tag.isClosing);
  const canonical = tags.find(
    (tag) => tag.name === 'link' && tag.attributes.get('rel') === 'canonical',
  );
  const robots = contentOf({ tag: metaOf({ tags, key: 'name', value: 'robots' }) });
  return {
    file,
    html,
    tags,
    title: titleTag === undefined ? '' : textOf({ html, tag: titleTag }).trim(),
    description: contentOf({ tag: metaOf({ tags, key: 'name', value: 'description' }) }),
    canonical: canonical === undefined ? null : (canonical.attributes.get('href') ?? ''),
    isIndexed: !robots.includes('noindex'),
  };
};

const headingChecks = ({ page }) => {
  const levels = page.tags
    .filter((tag) => /^h[1-6]$/.test(tag.name) && !tag.isClosing)
    .map((tag) => Number(tag.name[1]));
  const found = [];
  const h1s = levels.filter((level) => level === 1).length;
  if (h1s !== 1) {
    found.push(issue({ rule: 'h1-count', file: page.file, message: `${h1s} h1 elements` }));
  }
  levels.forEach((level, index) => {
    if (index > 0 && level > levels[index - 1] + 1) {
      found.push(
        issue({
          rule: 'heading-skip',
          file: page.file,
          message: `h${level} follows h${levels[index - 1]}`,
        }),
      );
    }
  });
  return found;
};

const imageChecks = ({ page }) =>
  page.tags
    .filter((tag) => tag.name === 'img' && !tag.isClosing)
    .flatMap((tag) => {
      const src = tag.attributes.get('src') ?? '';
      const found = [];
      if (!tag.attributes.has('alt') || tag.attributes.get('alt').trim() === '') {
        found.push(issue({ rule: 'img-alt', file: page.file, message: `img ${src} has no alt` }));
      }
      if (!tag.attributes.has('width') || !tag.attributes.has('height')) {
        found.push(
          issue({
            rule: 'img-size',
            file: page.file,
            message: `img ${src} has no width and height`,
          }),
        );
      }
      return found;
    });

const walkTypes = ({ node, visit }) => {
  if (Array.isArray(node)) {
    node.forEach((item) => walkTypes({ node: item, visit }));
    return;
  }
  if (node === null || typeof node !== 'object') {
    return;
  }
  visit({ node });
  Object.values(node).forEach((item) => walkTypes({ node: item, visit }));
};

const jsonLdChecks = ({ page }) => {
  const scripts = page.tags.filter(
    (tag) => tag.name === 'script' && tag.attributes.get('type') === 'application/ld+json',
  );
  if (scripts.length === 0) {
    return [issue({ rule: 'jsonld-invalid', file: page.file, message: 'no JSON-LD block' })];
  }
  return scripts.flatMap((script) => {
    let data;
    try {
      data = JSON.parse(script.body);
    } catch (error) {
      return [issue({ rule: 'jsonld-invalid', file: page.file, message: String(error.message) })];
    }
    const defined = new Set();
    const cited = new Set();
    const found = [];
    walkTypes({
      node: data,
      visit: ({ node }) => {
        const keys = Object.keys(node);
        if (keys.length === 1 && keys[0] === '@id') {
          cited.add(node['@id']);
          return;
        }
        if (typeof node['@id'] === 'string') {
          defined.add(node['@id']);
        }
        [node['@type']].flat().forEach((type) => {
          if (type !== undefined && !ALLOWED_TYPES.has(type)) {
            found.push(
              issue({
                rule: 'jsonld-type',
                file: page.file,
                message: `type ${type} is not allowed`,
              }),
            );
          }
        });
      },
    });
    cited.forEach((id) => {
      if (!defined.has(id)) {
        found.push(
          issue({ rule: 'jsonld-ref', file: page.file, message: `${id} is not in the graph` }),
        );
      }
    });
    return found;
  });
};

const OG_KEYS = ['og:title', 'og:description', 'og:url', 'og:image'];

const headChecks = ({ page, origin, sitemapPaths }) => {
  const found = [];
  const path = pathOfFile({ file: page.file });
  const url = `${origin}${path}`;
  if (page.title === '') {
    found.push(issue({ rule: 'title-missing', file: page.file, message: 'no title' }));
  }
  if (page.description === '') {
    found.push(issue({ rule: 'description-missing', file: page.file, message: 'no description' }));
  }
  if (
    page.title !== '' &&
    (page.title.length < TITLE_RANGE.min || page.title.length > TITLE_RANGE.max)
  ) {
    found.push(
      issue({
        rule: 'title-length',
        file: page.file,
        message: `title has ${page.title.length} characters, wanted ${TITLE_RANGE.min} to ${TITLE_RANGE.max}`,
      }),
    );
  }
  const length = page.description.length;
  if (length > 0 && (length < DESCRIPTION_RANGE.min || length > DESCRIPTION_RANGE.max)) {
    found.push(
      issue({
        rule: 'description-length',
        file: page.file,
        message: `description has ${length} characters, wanted ${DESCRIPTION_RANGE.min} to ${DESCRIPTION_RANGE.max}`,
      }),
    );
  }
  OG_KEYS.filter(
    (key) => contentOf({ tag: metaOf({ tags: page.tags, key: 'property', value: key }) }) === '',
  ).forEach((key) => {
    found.push(issue({ rule: 'og-missing', file: page.file, message: `no ${key}` }));
  });
  if (page.isIndexed) {
    if (page.canonical !== url) {
      found.push(
        issue({
          rule: 'canonical-mismatch',
          file: page.file,
          message: `canonical is ${page.canonical}, wanted ${url}`,
        }),
      );
    }
    if (!sitemapPaths.has(path)) {
      found.push(
        issue({
          rule: 'canonical-not-in-sitemap',
          file: page.file,
          message: `${path} is not in the sitemap`,
        }),
      );
    }
  } else {
    if (page.canonical !== null) {
      found.push(
        issue({
          rule: 'canonical-mismatch',
          file: page.file,
          message: 'a noindex page has a canonical',
        }),
      );
    }
    if (sitemapPaths.has(path)) {
      found.push(
        issue({
          rule: 'noindex-in-sitemap',
          file: page.file,
          message: `${path} is noindex and in the sitemap`,
        }),
      );
    }
  }
  return found;
};

const duplicateChecks = ({ pages, field, rule }) => {
  const groups = new Map();
  pages
    .filter((page) => page[field] !== '')
    .forEach((page) => groups.set(page[field], [...(groups.get(page[field]) ?? []), page.file]));
  return [...groups.values()]
    .filter((files) => files.length > 1)
    .flatMap((files) =>
      files.map((file) =>
        issue({
          rule,
          file,
          message: `${field} is shared by ${files.length} pages: ${files.join(', ')}`,
        }),
      ),
    );
};

export const sitemapPathsOf = ({ sitemap, origin }) =>
  new Set(
    [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, loc]) =>
      loc.startsWith(origin) ? loc.slice(origin.length) || '/' : loc,
    ),
  );

const sitemapChecks = ({ pages, sitemapPaths }) => {
  const indexed = new Set(
    pages.filter((page) => page.isIndexed).map((page) => pathOfFile({ file: page.file })),
  );
  const missing = [...indexed]
    .filter((path) => !sitemapPaths.has(path))
    .map((path) =>
      issue({
        rule: 'sitemap-missing-page',
        file: 'sitemap.xml',
        message: `${path} is indexed but not listed`,
      }),
    );
  const unknown = [...sitemapPaths]
    .filter((path) => !indexed.has(path))
    .map((path) =>
      issue({
        rule: 'sitemap-unknown-page',
        file: 'sitemap.xml',
        message: `${path} is listed but has no indexed page`,
      }),
    );
  return [...missing, ...unknown];
};

const RELEASE_PATH = /^\/changelog\/[^/]+$/;

const listedPathsOf = ({ text, pattern, origin }) =>
  new Set(
    [...text.matchAll(pattern)]
      .map(([, url]) => url)
      .filter((url) => url.startsWith(`${origin}/`))
      .map((url) => internalPath({ href: url.slice(origin.length) })),
  );

const listChecks = ({ llms, feed, sitemapPaths, origin }) => {
  const listed = listedPathsOf({ text: llms, pattern: /\]\(([^)\s]+)\)/g, origin });
  const fed = new Set(
    [...listedPathsOf({ text: feed, pattern: /<id>([^<]*)<\/id>/g, origin })].filter((path) =>
      RELEASE_PATH.test(path),
    ),
  );
  const found = [];
  [...sitemapPaths]
    .filter((path) => !RELEASE_PATH.test(path) && !listed.has(path))
    .forEach((path) => {
      found.push(
        issue({
          rule: 'llms-missing-page',
          file: 'llms.txt',
          message: `${path} is in the sitemap and not in llms.txt`,
        }),
      );
    });
  [...listed]
    .filter((path) => !sitemapPaths.has(path))
    .forEach((path) => {
      found.push(
        issue({
          rule: 'llms-unknown-page',
          file: 'llms.txt',
          message: `${path} is in llms.txt and not in the sitemap`,
        }),
      );
    });
  const releases = [...sitemapPaths].filter((path) => RELEASE_PATH.test(path));
  [
    ...releases.filter((path) => !fed.has(path)),
    ...[...fed].filter((path) => !sitemapPaths.has(path)),
  ].forEach((path) => {
    found.push(
      issue({
        rule: 'feed-mismatch',
        file: 'changelog.xml',
        message: `${path} is not in both the feed and the sitemap`,
      }),
    );
  });
  return found;
};

const existsInDist = ({ path, distFiles }) =>
  distFiles.has(path.slice(1)) ||
  distFiles.has(`${path.slice(1)}.html`) ||
  distFiles.has(`${path.slice(1)}/index.html`) ||
  path === '/';

const internalPath = ({ href }) => {
  if (!href.startsWith('/') || href.startsWith('//')) {
    return null;
  }
  const cut = href.search(/[?#]/);
  return cut === -1 ? href : href.slice(0, cut);
};

const redirectChecks = ({ redirects, distFiles }) => {
  const sources = new Map(redirects.map((redirect) => [redirect.source, redirect.destination]));
  return redirects.flatMap((redirect) => {
    const destination = internalPath({ href: redirect.destination });
    if (destination === null) {
      return [];
    }
    if (sources.has(destination)) {
      return [
        issue({
          rule: 'redirect-chain',
          file: 'vercel.json',
          message: `${redirect.source} goes to ${destination}, which redirects again`,
        }),
      ];
    }
    return existsInDist({ path: destination, distFiles })
      ? []
      : [
          issue({
            rule: 'redirect-dead',
            file: 'vercel.json',
            message: `${redirect.source} goes to ${destination}, which is not built`,
          }),
        ];
  });
};

const linkChecks = ({ page, redirects, distFiles }) => {
  const sources = new Set(redirects.map((redirect) => redirect.source));
  return page.tags
    .filter((tag) => tag.name === 'a' && !tag.isClosing)
    .flatMap((tag) => {
      const path = internalPath({ href: tag.attributes.get('href') ?? '' });
      if (path === null) {
        return [];
      }
      if (sources.has(path)) {
        return [
          issue({
            rule: 'link-to-redirect',
            file: page.file,
            message: `${path} is a redirect source`,
          }),
        ];
      }
      return existsInDist({ path, distFiles })
        ? []
        : [issue({ rule: 'link-broken', file: page.file, message: `${path} is not built` })];
    });
};

const publishedChecks = ({ published, redirects, distFiles }) => {
  const sources = new Set(redirects.map((redirect) => redirect.source));
  return published
    .filter((path) => !sources.has(path) && !existsInDist({ path, distFiles }))
    .map((path) =>
      issue({
        rule: 'published-missing',
        file: 'seo-published-paths.json',
        message: `${path} was published and is neither built nor redirected`,
      }),
    );
};

const trackingChecks = ({ page }) => {
  const found = [];
  const count = page.html.split(GTM_ID).length - 1;
  if (count > 1) {
    found.push(
      issue({ rule: 'gtm-count', file: page.file, message: `${GTM_ID} appears ${count} times` }),
    );
  }
  const first = page.html.indexOf(GTM_ID);
  const consent = page.html.search(/gtag\(\s*'consent'\s*,\s*'default'/);
  if (first !== -1 && (consent === -1 || consent > first)) {
    found.push(
      issue({
        rule: 'consent-order',
        file: page.file,
        message: 'Consent Mode default does not come before the Tag Manager id',
      }),
    );
  }
  return found;
};

export const checkSeo = ({
  htmlFiles,
  distFiles,
  sitemap,
  llms,
  feed,
  redirects,
  published,
  origin,
}) => {
  const pages = [...htmlFiles.entries()].map(([file, html]) => pageFacts({ file, html }));
  const sitemapPaths = sitemapPathsOf({ sitemap, origin });
  return [
    ...pages.flatMap((page) => [
      ...headChecks({ page, origin, sitemapPaths }),
      ...headingChecks({ page }),
      ...imageChecks({ page }),
      ...jsonLdChecks({ page }),
      ...linkChecks({ page, redirects, distFiles }),
      ...trackingChecks({ page }),
    ]),
    ...duplicateChecks({ pages, field: 'title', rule: 'title-duplicate' }),
    ...duplicateChecks({ pages, field: 'description', rule: 'description-duplicate' }),
    ...sitemapChecks({ pages, sitemapPaths }),
    ...listChecks({ llms, feed, sitemapPaths, origin }),
    ...redirectChecks({ redirects, distFiles }),
    ...publishedChecks({ published, redirects, distFiles }),
  ];
};

export const countsOf = ({ issues, severity }) => {
  const counts = {};
  issues
    .filter((found) => found.severity === severity)
    .forEach(({ rule, file }) => {
      counts[rule] = counts[rule] ?? {};
      counts[rule][file] = (counts[rule][file] ?? 0) + 1;
    });
  return counts;
};

const sorted = ({ counts }) =>
  Object.fromEntries(
    Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([rule, byFile]) => [
        rule,
        Object.fromEntries(
          Object.entries(byFile).sort(([left], [right]) => left.localeCompare(right)),
        ),
      ]),
  );

export const baselineOf = ({ counts }) => sorted({ counts });

export const growthLines = ({ counts, baseline }) =>
  Object.entries(counts).flatMap(([rule, byFile]) =>
    Object.entries(byFile).flatMap(([file, count]) => {
      const allowed = baseline[rule]?.[file] ?? 0;
      return count > allowed ? [`  - ${rule} ${file}: ${count} (baseline ${allowed})`] : [];
    }),
  );

export const staleLines = ({ counts, baseline }) =>
  Object.entries(baseline).flatMap(([rule, byFile]) =>
    Object.entries(byFile).flatMap(([file, allowed]) => {
      const count = counts[rule]?.[file] ?? 0;
      return count < allowed ? [`  - ${rule} ${file}: ${count} (baseline ${allowed})`] : [];
    }),
  );
