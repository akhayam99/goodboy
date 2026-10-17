import { NAMES } from '../../shared/names';
import type { LucideIcon } from 'lucide-react';
import { ArrowUp, GitMerge, RotateCcw, RotateCw, Send } from 'lucide-react';
import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';
import type { ResolvedAction } from '../actions/types';

type BranchPrimarySource = 'diff' | 'pullRequest' | 'review';

export type BranchPrimary = {
  readonly source: BranchPrimarySource;
  readonly actionId: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly blockedReason: string | null;
  readonly pendingLabel: string | null;
  readonly isBusy: boolean;
  readonly isSecondary: boolean;
  readonly note: string | null;
  readonly isExpanded: boolean | null;
};

export type BranchPushState = 'idle' | 'busy' | 'open';

export type BranchReviewCounts = {
  readonly accepted: number;
  readonly replies: number;
  readonly failed: number;
  readonly isPushing: boolean;
  readonly push: { readonly state: BranchPushState; readonly count: number };
};

type Params = {
  readonly diff: ReadonlyArray<ResolvedAction>;
  readonly pullRequest: ReadonlyArray<ResolvedAction>;
  readonly review: BranchReviewCounts;
  readonly hasPullRequest: boolean;
  readonly state: PullRequestPresentationState;
};

export type BranchActions = {
  readonly primary: BranchPrimary | null;
  readonly secondary: BranchPrimary | null;
};

const REVIEW_PUSH_ID = 'review.push';

const find = (actions: ReadonlyArray<ResolvedAction>, id: string): ResolvedAction | null =>
  actions.find((action) => action.id === id) ?? null;

const fromAction = ({
  source,
  action,
  label,
  icon,
  isSecondary = false,
}: {
  readonly source: BranchPrimarySource;
  readonly action: ResolvedAction;
  readonly label?: string;
  readonly icon?: LucideIcon;
  readonly isSecondary?: boolean;
}): BranchPrimary => ({
  source,
  actionId: action.id,
  label: label ?? action.shortLabel,
  icon: icon ?? action.icon,
  blockedReason: action.blockedReason,
  pendingLabel: action.pendingLabel,
  isBusy: action.isBusy,
  isSecondary,
  note: action.description,
  isExpanded: null,
});

const plural = ({ count, one, many }: { count: number; one: string; many: string }): string =>
  `${count} ${count === 1 ? one : many}`;

const reviewAction = ({
  label,
  icon,
  blockedReason = null,
  isBusy = false,
  isExpanded = null,
}: {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly blockedReason?: string | null;
  readonly isBusy?: boolean;
  readonly isExpanded?: boolean | null;
}): BranchPrimary => ({
  source: 'review',
  actionId: REVIEW_PUSH_ID,
  label,
  icon,
  blockedReason,
  pendingLabel: null,
  isBusy,
  isSecondary: false,
  note: null,
  isExpanded,
});

type FixesParams = {
  readonly count: number;
};

const fixes = ({ count }: FixesParams): string => plural({ count, one: 'fix', many: 'fixes' });

const secondaryOf = ({ diff, review, hasPullRequest, state }: Params): BranchPrimary | null => {
  if (state === 'merged' || state === 'closed') {
    return null;
  }
  if (hasPullRequest && (review.accepted > 0 || review.isPushing || review.push.state !== 'idle')) {
    const isBusy = review.isPushing || review.push.state === 'busy';
    const count = review.push.state === 'busy' ? review.push.count : review.accepted;
    return reviewAction({
      label: `${isBusy ? 'Pushing' : 'Push'} ${fixes({ count })}`,
      icon: ArrowUp,
      blockedReason: isBusy ? 'Pushing now.' : null,
      isBusy,
      isExpanded: review.push.state === 'open',
    });
  }
  const push = find(diff, 'diff.push');
  if (push !== null) {
    return fromAction({ source: 'diff', action: push, icon: ArrowUp });
  }
  if (hasPullRequest && review.replies > 0) {
    return reviewAction({
      label: `Publish ${plural({ count: review.replies, one: 'reply', many: 'replies' })}`,
      icon: ArrowUp,
    });
  }
  if (hasPullRequest && review.failed > 0) {
    return reviewAction({ label: NAMES.retryPush, icon: RotateCw });
  }
  return null;
};

const primaryOf = ({ diff, pullRequest, state }: Params): BranchPrimary | null => {
  if (find(diff, 'diff.continueRebase') !== null) {
    return null;
  }
  if (state === 'draft') {
    const ready = find(pullRequest, 'pullRequest.markReady');
    return ready === null
      ? null
      : fromAction({
          source: 'pullRequest',
          action: ready,
          label: 'Mark ready for review',
          icon: Send,
        });
  }
  if (state === 'open' || state === 'approved') {
    const merge = find(pullRequest, 'pullRequest.merge');
    return merge === null
      ? null
      : fromAction({
          source: 'pullRequest',
          action: merge,
          icon: GitMerge,
          isSecondary: merge.slot === 'secondary',
        });
  }
  if (state === 'closed') {
    const reopen = find(pullRequest, 'pullRequest.reopen');
    return reopen === null
      ? null
      : fromAction({ source: 'pullRequest', action: reopen, icon: RotateCcw });
  }
  return null;
};

export const branchActionsOf = (params: Params): BranchActions => ({
  primary: primaryOf(params),
  secondary: secondaryOf(params),
});

export const BRANCH_MENU_PULL_REQUEST: ReadonlyArray<string> = [
  'pullRequest.editDetails',
  'pullRequest.requestReview',
  'pullRequest.convertToDraft',
  'pullRequest.cancelAutoMerge',
  'pullRequest.close',
  'pullRequest.openOnGithub',
  'pullRequest.copyLink',
];

export const BRANCH_MENU_DIFF: ReadonlyArray<string> = [
  'diff.push',
  'diff.changeBase',
  'diff.copyPatch',
];
