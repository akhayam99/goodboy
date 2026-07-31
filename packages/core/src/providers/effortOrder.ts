import type { EffortLevel } from '@goodboy/types';

export const EFFORT_ORDER = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<EffortLevel>;
