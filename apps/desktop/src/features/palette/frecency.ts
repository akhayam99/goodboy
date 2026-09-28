export type FrecencyState = Readonly<Record<string, ReadonlyArray<number>>>;

type RecordUseParams = {
  readonly state: FrecencyState;
  readonly key: string;
  readonly now: number;
};

type FrecencyScoreParams = {
  readonly state: FrecencyState;
  readonly key: string;
  readonly now: number;
};

type ByScoreParams = {
  readonly state: FrecencyState;
  readonly now: number;
};

type RecentKeysParams = {
  readonly state: FrecencyState;
  readonly now: number;
  readonly limit: number;
};

export const FRECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
export const FRECENCY_MAX_USES = 10;
export const FRECENCY_MAX_KEYS = 200;

export const EMPTY_FRECENCY: FrecencyState = {};

export const frecencyScore = ({ state, key, now }: FrecencyScoreParams): number =>
  (state[key] ?? []).reduce(
    (sum, usedAt) => sum + 0.5 ** (Math.max(0, now - usedAt) / FRECENCY_HALF_LIFE_MS),
    0,
  );

const byScore = ({ state, now }: ByScoreParams) =>
  Object.keys(state)
    .map((key) => ({ key, score: frecencyScore({ state, key, now }) }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

export const recordUse = ({ state, key, now }: RecordUseParams): FrecencyState => {
  const uses = [now, ...(state[key] ?? [])].slice(0, FRECENCY_MAX_USES);
  const next: Record<string, ReadonlyArray<number>> = { ...state, [key]: uses };
  const keys = Object.keys(next);
  if (keys.length <= FRECENCY_MAX_KEYS) {
    return next;
  }
  const keep = new Set([
    key,
    ...byScore({ state: next, now })
      .filter((entry) => entry.key !== key)
      .slice(0, FRECENCY_MAX_KEYS - 1)
      .map((entry) => entry.key),
  ]);
  return Object.fromEntries(Object.entries(next).filter(([candidate]) => keep.has(candidate)));
};

export const recentKeys = ({ state, now, limit }: RecentKeysParams): ReadonlyArray<string> =>
  byScore({ state, now })
    .filter((entry) => entry.score > 0)
    .slice(0, limit)
    .map((entry) => entry.key);

const isUses = (value: unknown): value is ReadonlyArray<number> =>
  Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));

export const parseFrecency = (raw: string | null): FrecencyState => {
  if (raw === null) {
    return EMPTY_FRECENCY;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return EMPTY_FRECENCY;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, ReadonlyArray<number>] =>
        isUses(entry[1]),
      ),
    );
  } catch {
    return EMPTY_FRECENCY;
  }
};
