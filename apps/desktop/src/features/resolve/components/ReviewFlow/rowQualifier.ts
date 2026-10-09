import type { ReviewEntry } from './useReviewEntries';

const EXPLAIN: Partial<Record<ReviewEntry['state'], string>> = {
  ready: 'Fix ready, waiting for your review',
  edited: 'Fix ready, waiting for your review',
  outdated: 'Fix ready, waiting for your review',
  accepted: 'Accepted, goes out with the next push',
  replied: 'Reply only, goes out with the next push',
};

export const rowQualifierOf = ({ entry }: { readonly entry: ReviewEntry }): string | null => {
  const explain = EXPLAIN[entry.state];
  const chips = entry.chips.filter((chip) => chip !== entry.view?.word);
  const parts = [
    ...(explain === undefined ? [] : [explain]),
    ...(entry.view === null ? [] : [entry.view.word]),
    ...chips,
  ];
  return parts.length === 0 ? null : parts.join(' · ');
};
