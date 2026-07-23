import type { ReviewablePr, ReviewablePrProvider } from '@goodboy/types';

export type ReviewInboxScope = 'others' | 'all';

type Params = {
  readonly items: ReadonlyArray<ReviewablePr>;
  readonly provider: ReviewablePrProvider;
  readonly scope: ReviewInboxScope;
};

export const buildReviewInboxRows = ({
  items,
  provider,
  scope,
}: Params): ReadonlyArray<ReviewablePr> => {
  const scoped = items.filter(
    (pr) => pr.provider === provider && (scope === 'all' || !pr.mine),
  );
  return [...scoped].sort((a, b) => {
    if (a.reviewRequested !== b.reviewRequested) {
      return a.reviewRequested ? -1 : 1;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
};
