import type { PrReview } from '@goodboy/types';

type Params = {
  readonly reviews: ReadonlyArray<PrReview>;
};

export const latestReviews = ({ reviews }: Params): ReadonlyArray<PrReview> => {
  const reviewsByAuthor = new Map<string, PrReview>();

  for (const review of [...reviews].sort((first, second) =>
    (first.submittedAt ?? '').localeCompare(second.submittedAt ?? ''),
  )) {
    if (
      review.state === 'commented' ||
      review.state === 'pending' ||
      review.state === 'dismissed'
    ) {
      continue;
    }
    reviewsByAuthor.set(review.author, review);
  }

  return [...reviewsByAuthor.values()];
};
