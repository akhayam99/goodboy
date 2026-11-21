import { IDLE_DAYS } from './IDLE_DAYS';

type Params = {
  readonly lastTouchedMs: number | null;
  readonly now: () => number;
};

const DAY_MS = 86_400_000;

export const idleDaysOf = ({ lastTouchedMs, now }: Params): number | null => {
  if (lastTouchedMs === null) {
    return null;
  }
  const days = Math.floor((now() - lastTouchedMs) / DAY_MS);
  return days >= IDLE_DAYS ? days : null;
};
