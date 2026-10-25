export type TaskArrivals = {
  readonly firstSeen: ReadonlyMap<string, number>;
  readonly seenAt: number | null;
};

export const EMPTY_TASK_ARRIVALS: TaskArrivals = { firstSeen: new Map(), seenAt: null };

const DAY_MS = 86_400_000;
const KEEP_MS = 45 * DAY_MS;
const MAX_KEYS = 2_000;

type NoteParams = {
  readonly arrivals: TaskArrivals;
  readonly keys: ReadonlyArray<string>;
  readonly now: number;
};

export const noteFirstSeen = ({ arrivals, keys, now }: NoteParams): TaskArrivals => {
  const fresh = [...new Set(keys)].filter((key) => !arrivals.firstSeen.has(key));
  if (fresh.length === 0) {
    return arrivals;
  }
  const present = new Set(keys);
  const kept = [...arrivals.firstSeen].filter(
    ([key, at]) => present.has(key) || now - at < KEEP_MS,
  );
  const merged = [...kept, ...fresh.map((key): [string, number] => [key, now])];
  const newest = merged.sort((left, right) => right[1] - left[1]).slice(0, MAX_KEYS);
  return { ...arrivals, firstSeen: new Map(newest) };
};

type ArrivedParams = {
  readonly arrivals: TaskArrivals;
  readonly keys: ReadonlyArray<string>;
  readonly since: number | null;
};

export const arrivedKeysOf = ({ arrivals, keys, since }: ArrivedParams): ReadonlyArray<string> => {
  if (since === null) {
    return [];
  }
  return keys.filter((key) => (arrivals.firstSeen.get(key) ?? Number.NEGATIVE_INFINITY) > since);
};

type SeenParams = {
  readonly arrivals: TaskArrivals;
  readonly now: number;
};

export const markSeenAt = ({ arrivals, now }: SeenParams): TaskArrivals => ({
  ...arrivals,
  seenAt: now,
});
