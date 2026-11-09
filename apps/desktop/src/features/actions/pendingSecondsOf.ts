const SHOWN_AFTER_SECONDS = 3;

type Params = {
  readonly startedAt: number | null;
  readonly now: number;
};

export const pendingSecondsOf = ({ startedAt, now }: Params): number | null => {
  if (startedAt === null) {
    return null;
  }
  const seconds = Math.floor((now - startedAt) / 1_000);
  return seconds < SHOWN_AFTER_SECONDS ? null : seconds;
};
