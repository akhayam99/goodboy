import type { PrDetailRead, PullRequestState } from '@goodboy/types';

export type PrMergeReadiness = {
  readonly status: 'ready' | 'unknown' | 'blocked';
  readonly reason: string;
  readonly caveats: ReadonlyArray<string>;
};

const NO_CAVEATS: ReadonlyArray<string> = [];

const READY_REASON = 'Squash merge this pull request';
const UNKNOWN_REASON = 'GitHub has not finished checking whether this branch merges';
const CAVEAT_REASON = 'GitHub can still refuse this merge';

const CHECKS_UNKNOWN_REASON = 'Checks unknown';

type BlockingParams = {
  readonly pr: PullRequestState;
  readonly checksRead: PrDetailRead | null;
};

const blockingReason = ({ pr, checksRead }: BlockingParams): string | null => {
  if (pr.state === 'merged') {
    return 'This pull request is already merged';
  }
  if (pr.state === 'closed') {
    return 'Reopen this pull request before merging';
  }
  if (pr.state === 'queued') {
    return 'GitHub is already set to merge this pull request';
  }
  if (pr.isDraft) {
    return 'Mark this pull request ready before merging';
  }
  if (pr.mergeable === false) {
    return `Resolve the conflicts with ${pr.baseBranch} first`;
  }
  if (pr.checksUnknown === true || (checksRead !== null && checksRead !== 'ok')) {
    return CHECKS_UNKNOWN_REASON;
  }
  return null;
};

const mergeCaveats = ({ pr }: { readonly pr: PullRequestState }): ReadonlyArray<string> => {
  const caveats: Array<string> = [];
  if (pr.reviewDecision === 'changes_requested') {
    caveats.push('A reviewer asked for changes');
  }
  if (pr.reviewDecision === 'review_required') {
    caveats.push('A review is still requested');
  }
  if (pr.checks === 'failure') {
    caveats.push('Checks are failing');
  }
  if (pr.checks === 'pending') {
    caveats.push('Checks are still running');
  }
  return caveats;
};

export const evaluatePrMergeReadiness = ({
  pr,
  checksRead = null,
}: {
  readonly pr: PullRequestState;
  readonly checksRead?: PrDetailRead | null;
}): PrMergeReadiness => {
  const blocked = blockingReason({ pr, checksRead });
  if (blocked !== null) {
    return { status: 'blocked', reason: blocked, caveats: NO_CAVEATS };
  }
  const caveats = mergeCaveats({ pr });
  if (pr.mergeable === null) {
    return { status: 'unknown', reason: UNKNOWN_REASON, caveats };
  }
  if (caveats.length > 0) {
    return { status: 'ready', reason: CAVEAT_REASON, caveats };
  }
  return { status: 'ready', reason: READY_REASON, caveats: NO_CAVEATS };
};
