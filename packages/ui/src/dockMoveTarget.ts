export type DockMoveTarget =
  | { readonly at: 'beside'; readonly key: string; readonly side: 'before' | 'after' }
  | { readonly at: 'above' | 'below' | 'swap'; readonly key: string }
  | { readonly at: 'tab'; readonly key: string; readonly keeps?: ReadonlyArray<string> }
  | { readonly at: 'page' };

export type DockMoveUnit = 'panel' | 'cell';
