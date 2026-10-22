import type { LensKind } from '../session-view/types';

const RUNS_LENSES: ReadonlySet<LensKind> = new Set<LensKind>(['orchestrated', 'agents', 'auto']);

type Params = {
  readonly lens: LensKind | null;
};

export const foldedLensOf = ({ lens }: Params): LensKind | null =>
  lens !== null && RUNS_LENSES.has(lens) ? 'workflows' : lens;
