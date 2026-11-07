import type { SearchHit } from '@goodboy/types';

export type SearchModeItem =
  | { readonly kind: 'lookup'; readonly id: string; readonly url: string }
  | { readonly kind: 'result'; readonly id: string; readonly hit: SearchHit };
