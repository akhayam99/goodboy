import type { LensKind } from '../session-view/types';

type Params = {
  readonly lens: LensKind | null;
};

export const foldedLensOf = ({ lens }: Params): LensKind | null =>
  lens === 'orchestrated' ? 'workflows' : lens;
