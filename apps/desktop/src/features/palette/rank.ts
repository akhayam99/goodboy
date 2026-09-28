import { frecencyScore, type FrecencyState } from './frecency';
import { scoreFields } from './score';

export type RankCandidate = {
  readonly key: string;
  readonly label: string;
  readonly secondary?: ReadonlyArray<string>;
  readonly isScopeVerb?: boolean;
  readonly isBlocked?: boolean;
};

export type Ranked<T extends RankCandidate> = {
  readonly item: T;
  readonly score: number;
  readonly positions: ReadonlyArray<number>;
};

type Params<T extends RankCandidate> = {
  readonly items: ReadonlyArray<T>;
  readonly query: string;
  readonly frecency: FrecencyState;
  readonly now: number;
  readonly limit?: number;
};

type BoostParams = {
  readonly frecency: FrecencyState;
  readonly key: string;
  readonly now: number;
};

export const FRECENCY_WEIGHT = 12;
export const FRECENCY_CAP = 30;
export const SCOPE_BOOST = 25;
const DEFAULT_LIMIT = 60;

export const frecencyBoost = ({ frecency, key, now }: BoostParams): number =>
  Math.min(
    FRECENCY_CAP,
    FRECENCY_WEIGHT * Math.log1p(frecencyScore({ state: frecency, key, now })),
  );

export const rankCandidates = <T extends RankCandidate>({
  items,
  query,
  frecency,
  now,
  limit = DEFAULT_LIMIT,
}: Params<T>): ReadonlyArray<Ranked<T>> => {
  const isEmpty = query.trim().length === 0;
  const scored: Array<Ranked<T> & { readonly index: number }> = [];
  items.forEach((item, index) => {
    if (isEmpty && item.isBlocked === true) {
      return;
    }
    const match = scoreFields({ query, label: item.label, secondary: item.secondary ?? [] });
    if (match === null) {
      return;
    }
    if (item.isBlocked === true && !(match.isOnLabel && match.isWordPrefix)) {
      return;
    }
    const score =
      match.score +
      frecencyBoost({ frecency, key: item.key, now }) +
      (item.isScopeVerb === true ? SCOPE_BOOST : 0);
    scored.push({ item, score, positions: match.positions, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, limit).map(({ item, score, positions }) => ({ item, score, positions }));
};
