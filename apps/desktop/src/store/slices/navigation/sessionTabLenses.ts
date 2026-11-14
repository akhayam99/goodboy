import type { LensKind } from '../session-view/types';

export const SESSION_TAB_LENSES: ReadonlySet<LensKind> = new Set<LensKind>([
  'workflows',
  'orchestrated',
  'plans',
  'questions',
  'context',
]);
