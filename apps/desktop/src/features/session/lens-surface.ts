import type { LensKind } from '../../store';

export type ContextLens = 'decisions' | 'last_output_summary';

export type LensSurface = LensKind | 'overview';

type ContextRegionParams = {
  readonly lens: LensKind | null;
};

type LensSurfaceParams = {
  readonly lens: LensKind | null;
};

export const contextRegionFor = ({ lens }: ContextRegionParams): ContextLens | undefined =>
  lens === 'decisions' || lens === 'last_output_summary' ? lens : undefined;

export const resolveLensSurface = ({ lens }: LensSurfaceParams): LensSurface => {
  if (lens === null || lens === 'goal') {
    return 'overview';
  }
  if (contextRegionFor({ lens }) !== undefined) {
    return 'context';
  }
  return lens;
};
