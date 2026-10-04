export type PageMeta = {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly ogType: 'website' | 'article';
  readonly isIndexed: boolean;
};
