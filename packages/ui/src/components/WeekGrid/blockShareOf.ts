import type { WeekGridBlock } from './types';

type Params = {
  readonly block: WeekGridBlock;
  readonly spanMinutes: number;
};

const MIN_SHARE = 5;

export const blockShareOf = ({ block, spanMinutes }: Params): number =>
  Math.max(((block.endMinute - block.startMinute) / spanMinutes) * 100, MIN_SHARE);
