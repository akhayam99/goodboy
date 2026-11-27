import type { EffortLevel } from '@goodboy/types';

export const OPENROUTER_ALL_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<EffortLevel>;
