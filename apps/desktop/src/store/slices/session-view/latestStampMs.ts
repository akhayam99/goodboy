type Params = {
  readonly stamps: ReadonlyArray<string | number | null | undefined>;
};

export const latestStampMs = ({ stamps }: Params): number | null => {
  let latest: number | null = null;
  for (const stamp of stamps) {
    if (stamp === null || stamp === undefined) {
      continue;
    }
    const ms = typeof stamp === 'number' ? stamp : Date.parse(stamp);
    if (Number.isNaN(ms) || (latest !== null && latest >= ms)) {
      continue;
    }
    latest = ms;
  }
  return latest;
};
