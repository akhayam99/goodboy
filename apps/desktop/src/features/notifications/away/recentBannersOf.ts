const GROUP_WINDOW_MS = 30_000;

type Params = {
  readonly sentAt: ReadonlyArray<number>;
  readonly nowMs: number;
};

export const recentBannersOf = ({ sentAt, nowMs }: Params): ReadonlyArray<number> =>
  sentAt.filter((at) => nowMs - at < GROUP_WINDOW_MS);
