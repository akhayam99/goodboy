import { SITE } from '../site';
import { escapeHtml } from './escapeHtml';
import { jsonLd } from './jsonLd';
import type { PageMeta } from './PageMeta';

const OG_IMAGE = `${SITE.origin}/og-image.png?v=4`;
const OG_IMAGE_ALT =
  'Goodboy, a free desktop ADE built in public: Stop re-explaining yourself, with the coding agents and tools it works with';
const AUTHOR = 'Amin Khayam';
const X_HANDLE = '@GoodboyWorks';

type Params = {
  readonly page: PageMeta;
};

type TagParams = {
  readonly key: string;
  readonly value: string;
};

const named = ({ key, value }: TagParams) =>
  `<meta name="${key}" content="${escapeHtml(value)}" />`;

const property = ({ key, value }: TagParams) =>
  `<meta property="${key}" content="${escapeHtml(value)}" />`;

export const pageHead = ({ page }: Params) => {
  const url = `${SITE.origin}${page.path}`;
  return [
    `<title>${escapeHtml(page.title)}</title>`,
    named({ key: 'description', value: page.description }),
    named({ key: 'author', value: AUTHOR }),
    page.isIndexed
      ? `<link rel="canonical" href="${escapeHtml(url)}" />`
      : named({ key: 'robots', value: 'noindex' }),
    `<link rel="alternate" type="application/atom+xml" title="Goodboy changelog" href="${SITE.changelogFeed}" />`,
    property({ key: 'og:type', value: page.ogType }),
    property({ key: 'og:site_name', value: 'Goodboy' }),
    property({ key: 'og:url', value: url }),
    property({ key: 'og:title', value: page.title }),
    property({ key: 'og:description', value: page.description }),
    property({ key: 'og:image', value: OG_IMAGE }),
    property({ key: 'og:image:width', value: '1200' }),
    property({ key: 'og:image:height', value: '630' }),
    property({ key: 'og:image:alt', value: OG_IMAGE_ALT }),
    property({ key: 'og:locale', value: 'en_US' }),
    named({ key: 'twitter:card', value: 'summary_large_image' }),
    named({ key: 'twitter:site', value: X_HANDLE }),
    named({ key: 'twitter:creator', value: X_HANDLE }),
    named({ key: 'twitter:title', value: page.title }),
    named({ key: 'twitter:description', value: page.description }),
    named({ key: 'twitter:image', value: OG_IMAGE }),
    named({ key: 'twitter:image:alt', value: OG_IMAGE_ALT }),
    jsonLd({ page }),
  ].join('\n    ');
};
