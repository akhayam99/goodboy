export const LOG_PAGE_ROWS = 50;

type Params = {
  readonly count: number;
  readonly limit: number;
};

export type LogPage = {
  readonly shownCount: number;
  readonly hiddenCount: number;
  readonly nextCount: number;
};

export const logPageOf = ({ count, limit }: Params): LogPage => {
  const shownCount = Math.min(count, Math.max(limit, 0));
  const hiddenCount = count - shownCount;
  return { shownCount, hiddenCount, nextCount: Math.min(hiddenCount, LOG_PAGE_ROWS) };
};
