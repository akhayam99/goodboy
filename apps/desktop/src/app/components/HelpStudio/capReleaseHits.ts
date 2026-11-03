import type { HelpHit } from './searchHelp';

export const RELEASE_HIT_CAP = 3;

type Params = {
  readonly hits: ReadonlyArray<HelpHit>;
  readonly isAllShown: boolean;
};

export type CappedHits = {
  readonly shown: ReadonlyArray<HelpHit>;
  readonly hiddenCount: number;
};

export const capReleaseHits = ({ hits, isAllShown }: Params): CappedHits => {
  if (isAllShown) {
    return { shown: hits, hiddenCount: 0 };
  }
  let seen = 0;
  const shown = hits.filter((hit) => {
    if (hit.kind !== 'release') {
      return true;
    }
    seen += 1;
    return seen <= RELEASE_HIT_CAP;
  });
  return { shown, hiddenCount: hits.length - shown.length };
};
