export type ProjectCheckoutUpdate =
  | { readonly kind: 'updating' }
  | { readonly kind: 'updated'; readonly commits: number }
  | { readonly kind: 'skipped'; readonly reason: string }
  | { readonly kind: 'failed'; readonly reason: string };
