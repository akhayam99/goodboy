import { CONTENT_PAGES } from './CONTENT_PAGES';
import type { PageMeta } from './PageMeta';
import { STATIC_PAGES } from './STATIC_PAGES';

export const PAGE_REGISTRY: readonly PageMeta[] = [
  STATIC_PAGES.home,
  STATIC_PAGES.features,
  ...CONTENT_PAGES.map((entry) => entry.meta),
];
