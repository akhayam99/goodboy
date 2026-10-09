import type { PullRequestState } from '@goodboy/types';

type PrMergeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type PrMergeReadiness = {
  readonly status: 'ready' | 'unknown' | 'blocked';
  readonly tone: PrMergeTone;
  readonly reason: string;
  readonly word: string;
  readonly blockers: ReadonlyArray<string>;
  readonly caveats: ReadonlyArray<string>;
};

export type MergeReadinessFacts = {
  readonly pr: Pick<PullRequestState, 'baseBranch' | 'mergeable'> | null;
  readonly phase: 'none' | 'draft' | 'open' | 'queued' | 'merged' | 'closed';
  readonly checks: 'none' | 'pending' | 'failing' | 'green' | 'unknown';
  readonly failingChecks: ReadonlyArray<string>;
  readonly runningChecks: number;
  readonly review: PullRequestState['reviewDecision'];
  readonly changesRequestedBy: ReadonlyArray<string>;
  readonly hasConflicts: boolean;
  readonly writeInFlight: string | null;
  readonly commentsNeedYou: number;
  readonly isFixRunLive: boolean;
};

const UNKNOWN_REASON = 'GitHub has not finished checking whether this branch merges.';
const FIX_RUN_LIVE = 'A run is live on this branch';

const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}): string => `${count} ${count === 1 ? one : many}`;

const baseOf = ({ facts }: { readonly facts: MergeReadinessFacts }): string =>
  facts.pr?.baseBranch ?? 'the base branch';

const phaseBlocker = ({ facts }: { readonly facts: MergeReadinessFacts }): string | null => {
  switch (facts.phase) {
    case 'none':
      return 'This session has no pull request.';
    case 'merged':
      return 'This pull request is already merged.';
    case 'closed':
      return 'Reopen this pull request before merging.';
    case 'draft':
      return 'Mark this pull request ready before merging.';
    case 'queued':
      return 'GitHub is already set to merge this pull request.';
    case 'open':
      return null;
    default: {
      const unreachable: never = facts.phase;
      return unreachable;
    }
  }
};

const checksBlocker = ({ facts }: { readonly facts: MergeReadinessFacts }): string | null => {
  if (facts.checks === 'unknown') {
    return 'Checks unknown.';
  }
  if (facts.checks === 'failing') {
    const count = Math.max(facts.failingChecks.length, 1);
    const names = facts.failingChecks.length > 0 ? `: ${facts.failingChecks.join(', ')}` : '';
    return `${plural({ count, one: 'check', many: 'checks' })} failing${names}.`;
  }
  if (facts.checks === 'pending') {
    return facts.runningChecks > 0
      ? `${plural({ count: facts.runningChecks, one: 'check', many: 'checks' })} still running.`
      : 'Checks are still running.';
  }
  return null;
};

const reviewBlocker = ({ facts }: { readonly facts: MergeReadinessFacts }): string | null => {
  if (facts.review === 'changes_requested') {
    return facts.changesRequestedBy.length > 0
      ? `${facts.changesRequestedBy.join(', ')} asked for changes.`
      : 'A reviewer asked for changes.';
  }
  if (facts.review === 'review_required') {
    return 'Needs an approving review.';
  }
  return null;
};

const blockersOf = ({ facts }: { readonly facts: MergeReadinessFacts }): ReadonlyArray<string> => {
  const base = baseOf({ facts });
  const found = [
    facts.writeInFlight === null ? null : `${facts.writeInFlight}.`,
    phaseBlocker({ facts }),
    facts.hasConflicts ? `Conflicts with ${base}. Rebase on ${base} from the Branch header.` : null,
    checksBlocker({ facts }),
    reviewBlocker({ facts }),
  ];
  return found.filter((blocker): blocker is string => blocker !== null);
};

const commentsCaveat = ({ facts }: { readonly facts: MergeReadinessFacts }): string | null =>
  facts.commentsNeedYou > 0
    ? `${plural({ count: facts.commentsNeedYou, one: 'comment needs', many: 'comments need' })} you`
    : null;

const caveatsOf = ({ facts }: { readonly facts: MergeReadinessFacts }): ReadonlyArray<string> => {
  const comments = commentsCaveat({ facts });
  return [...(comments === null ? [] : [comments]), ...(facts.isFixRunLive ? [FIX_RUN_LIVE] : [])];
};

const waitingWord = ({ facts }: { readonly facts: MergeReadinessFacts }): string | null => {
  const isWaitingOnChecks = facts.checks === 'pending';
  const isWaitingOnReview = facts.review === 'review_required';
  if (isWaitingOnChecks && isWaitingOnReview) {
    return 'Waiting on checks and review';
  }
  if (isWaitingOnChecks) {
    return 'Waiting on checks';
  }
  return isWaitingOnReview ? 'Waiting on review' : null;
};

const blockedWord = ({ facts }: { readonly facts: MergeReadinessFacts }): string | null => {
  if (facts.phase === 'none') {
    return 'No pull request yet';
  }
  if (facts.phase === 'merged') {
    return 'Merged';
  }
  if (facts.phase === 'closed') {
    return 'Closed';
  }
  if (facts.phase === 'draft') {
    return 'Draft, not open for review yet';
  }
  if (facts.phase === 'queued') {
    return 'Set to merge when checks pass';
  }
  if (facts.hasConflicts) {
    return `Blocked: conflicts with ${baseOf({ facts })}`;
  }
  if (facts.checks === 'unknown') {
    return 'Blocked: checks unknown';
  }
  if (facts.checks === 'failing') {
    const count = Math.max(facts.failingChecks.length, 1);
    return `Blocked: ${plural({ count, one: 'check', many: 'checks' })} failing`;
  }
  if (facts.review === 'changes_requested') {
    return 'Changes requested';
  }
  return waitingWord({ facts });
};

const wordOf = ({ facts }: { readonly facts: MergeReadinessFacts }): string => {
  const blocked = blockedWord({ facts });
  if (blocked !== null) {
    return blocked;
  }
  const comments = commentsCaveat({ facts });
  if (comments !== null) {
    return facts.isFixRunLive ? `${comments}, a run is live` : comments;
  }
  return facts.isFixRunLive ? FIX_RUN_LIVE : 'Ready to merge';
};

const toneOf = ({
  facts,
  blockers,
}: {
  readonly facts: MergeReadinessFacts;
  readonly blockers: ReadonlyArray<string>;
}): PrMergeTone => {
  if (facts.phase !== 'open') {
    return 'neutral';
  }
  if (facts.hasConflicts || facts.checks === 'failing') {
    return 'danger';
  }
  if (facts.review === 'changes_requested' || facts.commentsNeedYou > 0) {
    return 'warning';
  }
  if (blockers.length > 0) {
    return 'neutral';
  }
  return facts.isFixRunLive ? 'info' : 'success';
};

export const evaluatePrMergeReadiness = ({
  facts,
}: {
  readonly facts: MergeReadinessFacts;
}): PrMergeReadiness => {
  const blockers = blockersOf({ facts });
  const caveats = caveatsOf({ facts });
  const word = wordOf({ facts });
  const tone = toneOf({ facts, blockers });
  if (blockers.length > 0) {
    return { status: 'blocked', tone, reason: blockers[0] ?? word, word, blockers, caveats };
  }
  if (facts.pr?.mergeable === null) {
    return { status: 'unknown', tone: 'neutral', reason: UNKNOWN_REASON, word, blockers, caveats };
  }
  return { status: 'ready', tone, reason: word, word, blockers, caveats };
};

export const mergeIsClear = ({ readiness }: { readonly readiness: PrMergeReadiness }): boolean =>
  readiness.status === 'ready' && readiness.caveats.length === 0;
