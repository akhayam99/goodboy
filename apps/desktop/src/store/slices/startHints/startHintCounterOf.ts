import { START_HINT_LIMITS } from './startHintLimits';

type Params = {
  readonly length: number;
};

export const startHintCounterOf = ({ length }: Params): string | null =>
  length >= START_HINT_LIMITS.counterFrom ? `${length} of ${START_HINT_LIMITS.max}` : null;
