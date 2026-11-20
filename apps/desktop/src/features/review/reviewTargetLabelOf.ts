import { PULL_REQUEST_NOUNS } from '@goodboy/core/review-source';
import type { ReviewTarget } from '../../store/slices/review-drafts/resolveReviewTarget';

type Params = {
  readonly target: ReviewTarget;
};

export const reviewTargetLabelOf = ({ target }: Params): string => {
  const name = target.repo.split('/').at(-1) ?? target.repo;
  return `${name} ${PULL_REQUEST_NOUNS[target.provider].numberPrefix}${target.prNumber}`;
};
