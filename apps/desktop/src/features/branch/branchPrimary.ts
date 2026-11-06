import { countNoun } from '../../shared/utils/countNoun';
import { NAMES } from '../../shared/utils/names';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  ArrowUp,
  Check,
  GitMerge,
  MessageSquare,
  PencilLine,
  RotateCcw,
  RotateCw,
  Send,
  Trash2,
  UserPlus,
  Wrench,
} from 'lucide-react';
import type { PullRequestPresentationState } from '../../shared/utils/pullRequestPresentation';
import type { ResolvedAction } from '../actions/types';
import { applyFixesLabel } from '../resolve/commentProjection';
import {
  branchStepOf,
  type BranchCheckFacts,
  type BranchClosingFacts,
  type BranchCommentFacts,
  type BranchLifecycleStep,
  type BranchStep,
} from './branchStepOf';

type BranchPrimarySource = 'diff' | 'pullRequest' | 'review' | 'step';

export type BranchStepAction = 'answer' | 'apply' | 'fixComments' | 'checks';

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
};

export type BranchPushState = 'idle' | 'busy' | 'open';

export type BranchReviewCounts = {
  readonly accepted: number;
  readonly replies: number;
  readonly failed: number;
  readonly isPushing: boolean;
  readonly push: { readonly state: BranchPushState; readonly count: number };
};

export type BranchNextStep = BranchLifecycleStep;

type Params = {
  readonly diff: ReadonlyArray<ResolvedAction>;
  readonly pullRequest: ReadonlyArray<ResolvedAction>;
  readonly review: BranchReviewCounts;
  readonly comments: BranchCommentFacts;
  readonly checks: BranchCheckFacts;
  readonly checkNote: string | null;
  readonly hasPullRequest: boolean;
  readonly state: PullRequestPresentationState;
  readonly nextStep: BranchNextStep;
  readonly hasConflicts: boolean;
  readonly hasOpenRebaseStop: boolean;
  readonly mergeLabel: string;
};

export type BranchActions = {
  readonly step: BranchStep;
  readonly primary: BranchPrimary | null;
  readonly secondary: BranchPrimary | null;
};

const REVIEW_PUSH_ID = 'review.push';

export const BRANCH_STEP_ID: Readonly<Record<BranchStepAction, string>> = {
  answer: 'step.answer',
  apply: 'step.apply',
  fixComments: 'step.fixComments',
  checks: 'step.checks',
};

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
});

type StepActionParams = {
  readonly action: BranchStepAction;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly note?: string | null;
};

const stepAction = ({ action, label, icon, note = null }: StepActionParams): BranchPrimary => ({
  source: 'step',
  actionId: BRANCH_STEP_ID[action],
  label,
  icon,
  blockedReason: null,
  pendingLabel: null,
  isBusy: false,
  note,
  isExpanded: null,
});

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
});

type HostParams = Pick<Params, 'hasPullRequest' | 'state'>;

type PushParams = HostParams & Pick<Params, 'diff' | 'review' | 'hasOpenRebaseStop'>;

const hasPullRequestPush = ({ hasPullRequest, state }: HostParams): boolean =>
  hasPullRequest && state !== 'merged' && state !== 'closed' && state !== 'none';

const isReviewPushInFlight = ({ review }: Pick<Params, 'review'>): boolean =>
  review.isPushing || review.push.state !== 'idle';

const pushOf = ({
  diff,
  review,
  hasOpenRebaseStop,
  hasPullRequest,
  state,
}: PushParams): BranchPrimary | null => {
  if (!hasPullRequestPush({ hasPullRequest, state })) {
    return null;
  }
  if (review.accepted > 0 || isReviewPushInFlight({ review })) {
    const isBusy = review.isPushing || review.push.state === 'busy';
    const count = review.push.count;
    return reviewAction({
      label: `${isBusy ? 'Pushing' : NAMES.push}${count > 0 ? ` ${countNoun({ count, one: 'commit', many: 'commits' })}` : ''}`,
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
  return null;
};

type CheckStepParams = Pick<Params, 'checkNote'> & {
  readonly step: BranchStep;
};

const checkStepOf = ({ step, checkNote }: CheckStepParams): BranchPrimary => {
  if (step === 'pushCheckFix') {
    return stepAction({ action: 'checks', label: 'Push fix', icon: ArrowUp });
  }
  if (step === 'startCheckFix') {
    return stepAction({ action: 'checks', label: 'Start fix', icon: Wrench });
  }
  return stepAction({ action: 'checks', label: 'Fix checks', icon: Wrench, note: checkNote });
};

type StepParams = Params & {
  readonly step: Exclude<BranchStep, null | 'working'>;
};

type RequestActionParams = Pick<FindParams, 'id'> & {
  readonly label: string;
  readonly icon: LucideIcon;
};

const stepPrimaryOf = ({
  step,
  diff,
  pullRequest,
  mergeLabel,
  comments,
  review,
  checkNote,
  hasOpenRebaseStop,
  hasPullRequest,
  state,
}: StepParams): BranchPrimary | null => {
  const push = (): BranchPrimary | null =>
    pushOf({ diff, review, hasOpenRebaseStop, hasPullRequest, state });
  const diffAction = ({ id }: Pick<FindParams, 'id'>) => {
    const action = find({ actions: diff, id });
    return action === null ? null : fromAction({ source: 'diff', action });
  };
  const closeAction = ({ id, label, icon }: RequestActionParams) => {
    const action = find({ actions: diff, id });
    return action === null ? null : fromAction({ source: 'diff', action, label, icon });
  };
  const requestAction = ({ id, label, icon }: RequestActionParams) => {
    const action = find({ actions: pullRequest, id });
    return action === null ? null : fromAction({ source: 'pullRequest', action, label, icon });
  };
  switch (step) {
    case 'answer':
      return stepAction({ action: 'answer', label: 'Answer', icon: MessageSquare });
    case 'apply':
      return stepAction({
        action: 'apply',
        label: applyFixesLabel({ count: comments.waitingFixes }),
        icon: Check,
      });
    case 'retryPush':
      return review.accepted > 0
        ? push()
        : reviewAction({ label: NAMES.retryPush, icon: RotateCw });
    case 'fixComments':
      return stepAction({
        action: 'fixComments',
        label: `Fix ${countNoun({ count: comments.fixable, one: 'comment', many: 'comments' })}`,
        icon: Wrench,
      });
    case 'publish':
      return reviewAction({
        label: `Publish ${countNoun({ count: review.replies, one: 'reply', many: 'replies' })}`,
        icon: ArrowUp,
      });
    case 'push':
      return push() ?? diffAction({ id: 'diff.push' });
    case 'pushCheckFix':
    case 'startCheckFix':
    case 'fixChecks':
      return checkStepOf({ step, checkNote });
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
    case 'review':
      return requestAction({ id: 'pullRequest.writeReview', label: 'Review', icon: PencilLine });
    case 'reopen':
      return requestAction({ id: 'pullRequest.reopen', label: 'Reopen', icon: RotateCcw });
    case 'removeWorktree':
      return closeAction({ id: 'diff.removeWorktree', label: NAMES.removeWorktree, icon: Trash2 });
    case 'archiveSession':
      return closeAction({ id: 'diff.archiveSession', label: 'Archive session', icon: Archive });
    default: {
      const unexpected: never = step;
      return unexpected;
    }
  }
};

type DiffStopParams = Pick<Params, 'diff' | 'hasOpenRebaseStop'>;

const canDiffPush = ({ diff, hasOpenRebaseStop }: DiffStopParams): boolean => {
  const push = find({ actions: diff, id: 'diff.push' });
  return push !== null && push.slot !== 'menu' && !hasOpenRebaseStop;
};

const isRebaseStopped = ({ diff, hasOpenRebaseStop }: DiffStopParams): boolean =>
  hasOpenRebaseStop || find({ actions: diff, id: 'diff.continueRebase' }) !== null;

const closingOf = ({ diff }: Pick<Params, 'diff'>): BranchClosingFacts => {
  const remove = find({ actions: diff, id: 'diff.removeWorktree' });
  return {
    canRemove: remove !== null && remove.blockedReason === null,
    canArchive: find({ actions: diff, id: 'diff.archiveSession' }) !== null,
  };
};

const stepFor = ({
  diff,
  review,
  comments,
  checks,
  hasPullRequest,
  state,
  nextStep,
  hasConflicts,
  hasOpenRebaseStop,
}: Params): BranchStep => {
  const isPullRequestPush = hasPullRequestPush({ hasPullRequest, state });
  return branchStepOf({
    state: hasPullRequest || state === 'none' ? state : 'merged',
    lifecycle: nextStep,
    hasConflicts,
    comments,
    checks,
    closing: closingOf({ diff }),
    push: {
      isInFlight: isPullRequestPush && isReviewPushInFlight({ review }),
      failed: isPullRequestPush ? review.failed : 0,
      canPush:
        isPullRequestPush && (review.accepted > 0 || canDiffPush({ diff, hasOpenRebaseStop })),
      replies: isPullRequestPush ? review.replies : 0,
    },
  });
};

export const branchActionsOf = ({ ...facts }: Params): BranchActions => {
  const step = stepFor(facts);
  if (step === null || step === 'working') {
    return { step, primary: null, secondary: null };
  }
  const primary = stepPrimaryOf({ ...facts, step });
  if (primary === null) {
    return { step, primary: null, secondary: null };
  }
  const isPushStep = step === 'push' || (step === 'retryPush' && facts.state === 'queued');
  if (isPushStep && hasPullRequestPush(facts)) {
    return primary.blockedReason !== null || facts.hasOpenRebaseStop || facts.state === 'queued'
      ? { step, primary: null, secondary: primary }
      : { step, primary, secondary: null };
  }
  if (isRebaseStopped(facts) || primary.blockedReason !== null) {
    return { step, primary: null, secondary: null };
  }
  return { step, primary, secondary: null };
};

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
  'diff.rebase',
  'diff.changeBase',
  'diff.copyPatch',
];
