import type { GuideHit } from '../../../features/settings/components/GuideStudio/searchChapters';
import { queryWordsOf } from '../../../features/settings/components/GuideStudio/queryWordsOf';

type ScoreParams = {
  readonly hit: GuideHit;
  readonly query: string;
  readonly words: ReadonlyArray<string>;
};

const scoreOf = ({ hit, query, words }: ScoreParams): number => {
  const label = (hit.term ?? hit.chapterTitle).toLowerCase();
  if (label === query) {
    return 0;
  }
  if (label.startsWith(query)) {
    return 1;
  }
  if (words.every((word) => label.includes(word))) {
    return 2;
  }
  return 3;
};

type Params = {
  readonly hits: ReadonlyArray<GuideHit>;
  readonly query: string;
};

export const rankGuideHits = ({ hits, query }: Params): ReadonlyArray<GuideHit> => {
  const words = queryWordsOf({ query });
  const needle = query.trim().toLowerCase();
  return hits
    .map((hit, index) => ({ hit, index, score: scoreOf({ hit, query: needle, words }) }))
    .sort((a, b) => (a.score === b.score ? a.index - b.index : a.score - b.score))
    .map((entry) => entry.hit);
};
