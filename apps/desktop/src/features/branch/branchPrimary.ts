import { NAMES } from '../../shared/names';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUp,
  GitMerge,
  MessageSquare,
  RotateCcw,
  RotateCw,
  Send,
  UserPlus,
  Wrench,
} from 'lucide-react';
import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';
import type { BranchTab } from '../../store/slices/navigation/types';
import type { ResolvedAction } from '../actions/types';
import type { PullRequestNextStep } from './pullRequestNextStepOf';

type BranchPrimarySource = 'diff' | 'pullRequest' | 'review' | 'tab';

export type BranchPrimary = {
  readonly source: BranchPrimarySource;
  readonly actionId: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly blockedReason: string | null;
  readonly pendingLabel: string | null;
  readonly isBusy: boolean;
  readonly note: string | null;
  readonly isExpanded: boolean | null;
  readonly tab: BranchTab | null;
};

export type BranchPushState = 'idle' | 'busy' | 'open';

export type BranchReviewCounts = {
  readonly accepted: number;
  readonly replies: number;
  readonly failed: number;
  readonly isPushing: boolean;
  readonly push: { readonly state: BranchPushState; readonly count: number };
};

export type BranchNextStep = 'push' | Exclude<PullRequestNextStep, null> | null;

type Params = {
  readonly diff: ReadonlyArray<ResolvedAction>;
  readonly pullRequest: ReadonlyArray<ResolvedAction>;
  readonly review: BranchReviewCounts;
  readonly hasPullRequest: boolean;
  readonly state: PullRequestPresentationState;
  readonly nextStep: BranchNextStep;
  readonly hasOpenRebaseStop: boolean;
  readonly mergeLabel: string;
};

export type BranchActions = {
  readonly primary: BranchPrimary | null;
  readonly secondary: BranchPrimary | null;
};

const REVIEW_PUSH_ID = 'review.push';

type FindParams = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly id: string;
};

const find = ({ actions, id }: FindParams): ResolvedAction | null =>
  actions.find((action) => action.id === id) ?? null;

type FromActionParams = {
  readonly source: BranchPrimarySource;
  readonly action: ResolvedAction;
  readonly label?: string;
  readonly icon?: LucideIcon;
};

const fromAction = ({ source, action, label, icon }: FromActionParams): BranchPrimary => ({
  source,
  actionId: action.id,
  label: label ?? action.shortLabel,
  icon: icon ?? action.icon,
  blockedReason: action.blockedReason,
  pendingLabel: action.pendingLabel,
  isBusy: action.isBusy,
  note: action.description,
  isExpanded: null,
  tab: null,
});

type TabParams = {
  readonly tab: BranchTab;
  readonly label: string;
  readonly icon: LucideIcon;
};

const fromTab = ({ tab, label, icon }: TabParams): BranchPrimary => ({
  source: 'tab',
  actionId: `tab.${tab}`,
  label,
  icon,
  blockedReason: null,
  pendingLabel: null,
  isBusy: false,
  note: null,
  isExpanded: null,
  tab,
});

type PluralParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const plural = ({ count, one, many }: PluralParams): string =>
  `${count} ${count === 1 ? one : many}`;

type ReviewActionParams = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly blockedReason?: string | null;
  readonly isBusy?: boolean;
  readonly isExpanded?: boolean | null;
};

const reviewAction = ({
  label,
  icon,
  blockedReason = null,
  isBusy = false,
  isExpanded = null,
}: ReviewActionParams): BranchPrimary => ({
  source: 'review',
  actionId: REVIEW_PUSH_ID,
  label,
  icon,
  blockedReason,
  pendingLabel: null,
  isBusy,
  note: null,
  isExpanded,
  tab: null,
});

type FixesParams = {
  readonly count: number;
};

const fixes = ({ count }: FixesParams): string => plural({ count, one: 'fix', many: 'fixes' });

const secondaryOf = ({
  diff,
  review,
  hasPullRequest,
  state,
  hasOpenRebaseStop,
}: Params): BranchPrimary | null => {
  if (state === 'merged' || state === 'closed' || state === 'none' || !hasPullRequest) {
    return null;
  }
  if (review.accepted > 0 || review.isPushing || review.push.state !== 'idle') {
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
  const push = find({ actions: diff, id: 'diff.push' });
  if (push !== null && push.slot !== 'menu' && !hasOpenRebaseStop) {
    return fromAction({ source: 'diff', action: push, icon: ArrowUp });
  }
  if (review.replies > 0) {
    return reviewAction({
      label: `Publish ${plural({ count: review.replies, one: 'reply', many: 'replies' })}`,
      icon: ArrowUp,
    });
  }
  if (review.failed > 0) {
    return reviewAction({ label: NAMES.retryPush, icon: RotateCw });
  }
  return null;
};

type StepParams = Params & {
  readonly step: Exclude<BranchNextStep, null>;
};

const stepPrimaryOf = ({
  step,
  diff,
  pullRequest,
  mergeLabel,
}: StepParams): BranchPrimary | null => {
  const diffAction = ({ id }: Pick<FindParams, 'id'>) => {
    const action = find({ actions: diff, id });
    return action === null ? null : fromAction({ source: 'diff', action });
  };
  const requestAction = ({ id, label, icon }: Pick<FindParams, 'id'> & Omit<TabParams, 'tab'>) => {
    const action = find({ actions: pullRequest, id });
    return action === null ? null : fromAction({ source: 'pullRequest', action, label, icon });
  };
  switch (step) {
    case 'push':
      return diffAction({ id: 'diff.push' });
    case 'rebase':
      return diffAction({ id: 'diff.rebase' });
    case 'markReady':
      return requestAction({
        id: 'pullRequest.markReady',
        label: 'Mark ready for review',
        icon: Send,
      });
    case 'requestReview':
      return requestAction({
        id: 'pullRequest.requestReview',
        label: 'Request review',
        icon: UserPlus,
      });
    case 'merge':
      return requestAction({ id: 'pullRequest.merge', label: mergeLabel, icon: GitMerge });
    case 'reopen':
      return requestAction({ id: 'pullRequest.reopen', label: 'Reopen', icon: RotateCcw });
    case 'fixChecks':
      return fromTab({ tab: 'checks', label: 'Fix checks', icon: Wrench });
    case 'fixComments':
      return fromTab({ tab: 'comments', label: 'Fix comments', icon: MessageSquare });
    default: {
      const unexpected: never = step;
      return unexpected;
    }
  }
};

const primaryOf = (params: Params): BranchPrimary | null => {
  if (
    params.nextStep === null ||
    params.hasOpenRebaseStop ||
    find({ actions: params.diff, id: 'diff.continueRebase' }) !== null
  ) {
    return null;
  }
  const primary = stepPrimaryOf({ ...params, step: params.nextStep });
  return primary === null || primary.blockedReason !== null ? null : primary;
};

export const branchActionsOf = (params: Params): BranchActions => ({
  primary: primaryOf(params),
  secondary: secondaryOf(params),
});

export const BRANCH_MENU_PULL_REQUEST: ReadonlyArray<string> = [
  'pullRequest.merge',
  'pullRequest.markReady',
  'pullRequest.reopen',
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
