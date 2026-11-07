import type { LensKind } from '../../store';

export type LensSurface = LensKind | 'overview';

type LensSurfaceParams = {
  readonly lens: LensKind | null;
};

export const resolveLensSurface = ({ lens }: LensSurfaceParams): LensSurface => {
  if (lens === null) {
    return 'overview';
  }
  return lens;
};
