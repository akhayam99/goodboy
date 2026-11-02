import type { DiffLayoutMode } from './diffLayoutMode';

export const SPLIT_MIN_INNER_PX = 880;

type Params = {
  readonly preference: DiffLayoutMode;
  readonly innerWidthPx: number | null;
};

export type EffectiveDiffLayout = {
  readonly layout: DiffLayoutMode;
  readonly isSplitAvailable: boolean;
};

export const effectiveDiffLayout = ({ preference, innerWidthPx }: Params): EffectiveDiffLayout => {
  const isSplitAvailable = innerWidthPx === null || innerWidthPx >= SPLIT_MIN_INNER_PX;
  if (preference === 'split' && !isSplitAvailable) {
    return { layout: 'unified', isSplitAvailable };
  }
  return { layout: preference, isSplitAvailable };
};
