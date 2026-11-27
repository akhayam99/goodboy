import type { ChipView } from './callChipTypes';

const SNOOZED_SHOWN_MS = 4_000;
const STARTED_SHOWN_MS = 10 * 60_000;

type Params = {
  readonly view: ChipView;
  readonly shownAt: number;
};

export const chipExpiryOf = ({ view, shownAt }: Params): number | null => {
  if (view.kind === 'snoozed') {
    return shownAt + SNOOZED_SHOWN_MS;
  }
  if (view.kind === 'countdown') {
    return Math.min(view.start + STARTED_SHOWN_MS, view.end);
  }
  return null;
};
