export type PageSource = {
  readonly kind: 'page';
  readonly title: string;
  readonly host: string;
  readonly url: string;
  readonly wordCount: number;
  readonly readAt: number;
  readonly iconSrc: string | null;
};
