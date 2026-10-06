import type { DiffLayoutMode } from '@goodboy/ui';

const SPLIT_MIN_INNER_PX = 880;

type Params = {
  readonly preference: DiffLayoutMode;
  readonly innerWidthPx: number | null;
};

export type EffectiveDiffLayout = {
  readonly layout: DiffLayoutMode;
  readonly isSplitTooNarrow: boolean;
};

export const effectiveDiffLayout = ({ preference, innerWidthPx }: Params): EffectiveDiffLayout => {
  if (preference !== 'split' || innerWidthPx === null || innerWidthPx >= SPLIT_MIN_INNER_PX) {
    return { layout: preference, isSplitTooNarrow: false };
  }
  return { layout: 'unified', isSplitTooNarrow: true };
};
