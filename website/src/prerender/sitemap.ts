import { SITE } from '../site';
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
      .map(
        (page) =>
          `  <url><loc>${escapeHtml(`${SITE.origin}${page.path}`)}</loc><lastmod>${page.lastmod}</lastmod></url>`,
      ),
    '</urlset>',
    '',
  ].join('\n');
