import type { LucideIcon } from 'lucide-react';
import { ArrowUp, GitBranch, GitMerge, GitPullRequestCreate, RotateCw, Send } from 'lucide-react';
import type { ResolvedAction } from '../actions/types';

export type BranchPrimarySource = 'diff' | 'pullRequest' | 'review';

export type BranchPrimary = {
  readonly source: BranchPrimarySource;
  readonly actionId: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly blockedReason: string | null;
  readonly isBusy: boolean;
};

export type BranchReviewCounts = {
  readonly accepted: number;
  readonly replies: number;
  readonly failed: number;
  readonly isPushing: boolean;
};

type Params = {
  readonly diff: ReadonlyArray<ResolvedAction>;
  readonly pullRequest: ReadonlyArray<ResolvedAction>;
  readonly review: BranchReviewCounts;
  readonly hasPullRequest: boolean;
};

const REVIEW_PUSH_ID = 'review.push';

const find = (actions: ReadonlyArray<ResolvedAction>, id: string): ResolvedAction | null =>
  actions.find((action) => action.id === id) ?? null;

const fromAction = ({
  source,
  action,
  label,
  icon,
}: {
  readonly source: BranchPrimarySource;
  readonly action: ResolvedAction;
  readonly label?: string;
  readonly icon?: LucideIcon;
}): BranchPrimary => ({
  source,
  actionId: action.id,
  label: label ?? action.shortLabel,
  icon: icon ?? action.icon,
  blockedReason: action.blockedReason,
  isBusy: action.isBusy,
});

const plural = ({ count, one, many }: { count: number; one: string; many: string }): string =>
  `${count} ${count === 1 ? one : many}`;

export const branchPrimaryOf = ({
  diff,
  pullRequest,
  review,
  hasPullRequest,
}: Params): BranchPrimary | null => {
  const rebase = find(diff, 'diff.rebase') ?? find(diff, 'diff.continueRebase');
  if (rebase !== null) {
    return fromAction({ source: 'diff', action: rebase, icon: GitBranch });
  }
  if (hasPullRequest && (review.accepted > 0 || review.isPushing)) {
    return {
      source: 'review',
      actionId: REVIEW_PUSH_ID,
      label: `Push ${review.accepted}`,
      icon: ArrowUp,
      blockedReason: review.isPushing ? 'Pushing now.' : null,
      isBusy: review.isPushing,
    };
  }
  const push = find(diff, 'diff.push');
  if (push !== null) {
    return fromAction({ source: 'diff', action: push, icon: ArrowUp });
  }
  if (hasPullRequest && review.replies > 0) {
    return {
      source: 'review',
      actionId: REVIEW_PUSH_ID,
      label: `Publish ${plural({ count: review.replies, one: 'reply', many: 'replies' })}`,
      icon: ArrowUp,
      blockedReason: null,
      isBusy: false,
    };
  }
  if (hasPullRequest && review.failed > 0) {
    return {
      source: 'review',
      actionId: REVIEW_PUSH_ID,
      label: `Retry ${review.failed}`,
      icon: RotateCw,
      blockedReason: null,
      isBusy: false,
    };
  }
  const createOnDiff = find(diff, 'diff.createPullRequest');
  const create = createOnDiff ?? find(pullRequest, 'pullRequest.create');
  if (create !== null) {
    return fromAction({
      source: createOnDiff === null ? 'pullRequest' : 'diff',
      action: create,
      label: createOnDiff === null ? 'Create PR' : createOnDiff.shortLabel,
      icon: GitPullRequestCreate,
    });
  }
  const ready = find(pullRequest, 'pullRequest.markReady');
  if (ready !== null) {
    return fromAction({
      source: 'pullRequest',
      action: ready,
      label: 'Ready for review',
      icon: Send,
    });
  }
  const merge = find(pullRequest, 'pullRequest.merge');
  if (merge !== null) {
    return fromAction({ source: 'pullRequest', action: merge, label: 'Merge', icon: GitMerge });
  }
  return null;
};

export const BRANCH_MENU_PULL_REQUEST: ReadonlyArray<string> = [
  'pullRequest.editDetails',
  'pullRequest.requestReview',
  'pullRequest.convertToDraft',
  'pullRequest.close',
  'pullRequest.reopen',
  'pullRequest.openOnGithub',
  'pullRequest.copyLink',
];

export const BRANCH_MENU_DIFF: ReadonlyArray<string> = [
  'diff.changeBase',
  'diff.openTerminal',
  'diff.openInEditor',
  'diff.copyBranch',
  'diff.copyPatch',
  'diff.abortRebase',
];
