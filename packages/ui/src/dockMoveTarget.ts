export type DockMoveTarget =
  | { readonly at: 'beside'; readonly key: string; readonly side: 'before' | 'after' }
  | { readonly at: 'above' | 'below' | 'swap' | 'tab'; readonly key: string }
  | { readonly at: 'page' };

export type DockMoveUnit = 'panel' | 'cell';
