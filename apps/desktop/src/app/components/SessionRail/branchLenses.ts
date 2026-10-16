import type { LensKind } from '../../../store';

export const BRANCH_LENSES: ReadonlySet<LensKind | null> = new Set<LensKind | null>([
  'branch',
  'review',
  'pr',
  'files',
]);
