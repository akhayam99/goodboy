import type { LensKind } from '../../store';
import { isContextLens } from '../../store/slices/navigation/contextLensTab';

export type LensSurface = LensKind | 'overview';

type LensSurfaceParams = {
  readonly lens: LensKind | null;
};

export const resolveLensSurface = ({ lens }: LensSurfaceParams): LensSurface => {
  if (lens === null || isContextLens({ lens })) {
    return 'overview';
  }
  return lens;
};
