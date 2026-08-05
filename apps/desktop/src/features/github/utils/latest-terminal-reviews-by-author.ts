import type { PrReview } from '@goodboy/types';

export const latestTerminalReviewsByAuthor = (
  reviews: ReadonlyArray<PrReview>,
): ReadonlyArray<PrReview> => {
  const map = new Map<string, PrReview>();
  for (const r of [...reviews].sort((a, b) =>
    (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''),
  )) {
    if (r.state === 'commented' || r.state === 'pending' || r.state === 'dismissed') {
      continue;
    }
    map.set(r.author, r);
  }
  return [...map.values()];
};
