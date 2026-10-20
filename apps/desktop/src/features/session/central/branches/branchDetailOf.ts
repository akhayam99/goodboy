import type { PrDetail } from '@goodboy/types';
import { openReviewThreadIds } from '../../../../store/slices/resolve/openReviewThreadIds';
import type { BranchFacts } from './branchFactsOf';
import type { BranchDetailWords } from './branchStoryOf';

const FAILED_CONCLUSIONS: ReadonlyArray<string> = ['failure', 'timed_out', 'cancelled'];

const MAX_NAMES = 2;

type NeedsParams = {
  readonly fact: BranchFacts;
};

export const needsBranchDetail = ({ fact }: NeedsParams): boolean => {
  const request = fact.request;
  if (request === null || fact.isFinished || fact.isStale || request.state !== 'open') {
    return false;
  }
  return request.checks === 'failure' || request.reviewDecision === 'changes_requested';
};

type Params = {
  readonly fact: BranchFacts;
  readonly detail: PrDetail | null | undefined;
};

export const branchDetailOf = ({ fact, detail }: Params): BranchDetailWords | null => {
  const request = fact.request;
  if (request === null || detail === null || detail === undefined) {
    return null;
  }
  if (detail.prNumber !== request.number) {
    return null;
  }
  const failed = detail.checks.filter((check) => FAILED_CONCLUSIONS.includes(check.conclusion));
  const names = failed.map((check) => check.name);
  const shown = names.slice(0, MAX_NAMES);
  const rest = names.length - shown.length;
  return {
    failingChecks: rest > 0 ? [...shown, `${rest} more`] : shown,
    openThreads: openReviewThreadIds({ comments: detail.comments }).length,
  };
};
