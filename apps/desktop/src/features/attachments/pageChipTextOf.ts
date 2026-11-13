import { countNoun } from '../../shared/utils/countNoun';
import { formatClock } from '../../shared/utils/time/formatClock';
import type { PageSource } from '../../shared/types/pageSource';

const FRESH_MS = 60_000;
const THOUSAND = 1_000;

type Params = {
  readonly source: PageSource;
  readonly now: number;
};

type WordsParams = {
  readonly wordCount: number;
};

type PageChipText = {
  readonly title: string;
  readonly detail: string;
  readonly hover: string;
};

const wordsLabelOf = ({ wordCount }: WordsParams): string =>
  wordCount < THOUSAND
    ? countNoun({ count: wordCount, one: 'word' })
    : `${(wordCount / THOUSAND).toFixed(1)}k words`;

export const pageChipTextOf = ({ source, now }: Params): PageChipText => {
  const isStale = now - source.readAt > FRESH_MS;
  return {
    title: source.title,
    detail: `${source.host} · ${wordsLabelOf({ wordCount: source.wordCount })}`,
    hover: isStale ? `${source.url}. Read at ${formatClock({ at: source.readAt })}.` : source.url,
  };
};
