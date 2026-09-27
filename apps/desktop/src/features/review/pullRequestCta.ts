import type { PrComment, PrReview } from '@goodboy/types';
import { openReviewThreadIds } from '../../store/slices/resolve/openReviewThreadIds';

export type PullRequestCta = {
  readonly openCount: number;
  readonly changesRequestedBy: ReadonlyArray<string>;
};

type Params = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly reviews: ReadonlyArray<PrReview>;
};

const latestVerdicts = ({
  reviews,
}: {
  readonly reviews: ReadonlyArray<PrReview>;
}): ReadonlyMap<string, PrReview> => {
  const byAuthor = new Map<string, PrReview>();
  for (const review of reviews) {
    if (review.state === 'commented' || review.state === 'pending') {
      continue;
    }
    const previous = byAuthor.get(review.author);
    if (previous === undefined || (review.submittedAt ?? '') >= (previous.submittedAt ?? '')) {
      byAuthor.set(review.author, review);
    }
  }
  return byAuthor;
};

export const pullRequestCta = ({ comments, reviews }: Params): PullRequestCta | null => {
  const openCount = openReviewThreadIds({ comments }).length;
  const changesRequestedBy = [...latestVerdicts({ reviews }).values()]
    .filter((review) => review.state === 'changes_requested')
    .map((review) => review.author);
  if (openCount === 0 && changesRequestedBy.length === 0) {
    return null;
  }
  return { openCount, changesRequestedBy };
};

export const RESOLVE_IN_REVIEW = 'Resolve in Review';

export const pullRequestCtaTitle = ({ openCount, changesRequestedBy }: PullRequestCta): string => {
  const parts: Array<string> = [];
  if (openCount > 0) {
    parts.push(
      `${openCount} ${openCount === 1 ? 'conversation needs' : 'conversations need'} an answer`,
    );
  }
  if (changesRequestedBy.length > 0) {
    parts.push(`changes requested by ${changesRequestedBy.join(', ')}`);
  }
  const sentence = parts.join(' · ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
};
