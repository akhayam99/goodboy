import { SITE } from '../lib/site';
import { escapeHtml } from './escapeHtml';
import type { PageMeta } from './PageMeta';

type Params = {
  readonly pages: readonly PageMeta[];
};

export const sitemap = ({ pages }: Params) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages
      .filter((page) => page.isIndexed)
      .map((page) => {
        const loc = escapeHtml(`${SITE.origin}${page.path}`);
        const lastmod = page.lastmod === undefined ? '' : `<lastmod>${page.lastmod}</lastmod>`;
        return `  <url><loc>${loc}</loc>${lastmod}</url>`;
      }),
    '</urlset>',
    '',
  ].join('\n');
