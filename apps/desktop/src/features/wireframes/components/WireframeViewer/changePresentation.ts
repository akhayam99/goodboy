import type { WireframeNodeChangeKind, WireframeScreenChangeKind } from '@goodboy/core';

export const CHANGE_GLYPH = {
  added: '+',
  changed: '~',
  removed: '−',
  same: '=',
} as const satisfies Record<WireframeNodeChangeKind | WireframeScreenChangeKind, string>;

export const CHANGE_WORD = {
  added: 'Added',
  changed: 'Changed',
  removed: 'Removed',
  same: 'Same',
} as const satisfies Record<WireframeNodeChangeKind | WireframeScreenChangeKind, string>;
