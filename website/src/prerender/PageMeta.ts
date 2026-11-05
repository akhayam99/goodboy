import type { Crumb } from '../pages/content/Breadcrumbs';

export type PageKind =
  'home' | 'features' | 'docs-index' | 'doc' | 'changelog-index' | 'release' | 'not-found';

export type PageMeta = {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly ogType: 'website' | 'article';
  readonly kind: PageKind;
  readonly pageType: 'WebPage' | 'CollectionPage';
  readonly crumbs: readonly Crumb[];
  readonly lastmod?: string;
  readonly isIndexed: boolean;
};
