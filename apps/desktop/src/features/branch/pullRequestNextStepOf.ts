import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';
import type { MergeReadinessFacts, PrMergeReadiness } from '../review/prMergeReadiness';
import { mergeIsClear } from '../review/prMergeReadiness';

export type PullRequestNextStep =
  | 'markReady'
  | 'requestReview'
  | 'fixComments'
  | 'fixChecks'
  | 'rebase'
  | 'merge'
  | 'reopen'
  | null;

type Params = {
  readonly state: PullRequestPresentationState;
  readonly facts: Pick<
    MergeReadinessFacts,
    'checks' | 'review' | 'hasConflicts' | 'commentsNeedYou' | 'isFixRunLive'
  >;
  readonly readiness: PrMergeReadiness;
  readonly hasReviewer: boolean;
  readonly behind: number;
  readonly isStopOpen: boolean;
};

const openStepOf = ({
  facts,
  readiness,
  hasReviewer,
  behind,
  isStopOpen,
}: Params): PullRequestNextStep => {
  if (isStopOpen) {
    return null;
  }
  if (facts.hasConflicts) {
    return behind > 0 ? 'rebase' : null;
  }
  if (facts.checks === 'failing') {
    return 'fixChecks';
  }
  if (facts.review === 'changes_requested' || facts.commentsNeedYou > 0) {
    return facts.isFixRunLive ? null : 'fixComments';
  }
  if (mergeIsClear({ readiness })) {
    return 'merge';
  }
  if (!hasReviewer && facts.review !== 'approved') {
    return 'requestReview';
  }
  if (facts.checks === 'pending' || facts.review === 'review_required') {
    return null;
  }
  return behind > 0 ? 'rebase' : null;
};

export const pullRequestNextStepOf = (params: Params): PullRequestNextStep => {
  switch (params.state) {
    case 'none':
    case 'merged':
    case 'queued':
      return null;
    case 'draft':
      return 'markReady';
    case 'closed':
      return 'reopen';
    case 'open':
    case 'approved':
      return openStepOf(params);
    default: {
      const unexpected: never = params.state;
      return unexpected;
    }
  }
};
