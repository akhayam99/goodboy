import type { PullRequestState, Session, SessionAttentionReason } from '@goodboy/types';
import { isPullRequestApproved } from './pullRequestGroup';

export type StagePullRequest = Pick<
  PullRequestState,
  'number' | 'state' | 'isDraft' | 'checks' | 'reviewDecision'
>;

export type AttentionFactsParams = {
  readonly session: Session;
  readonly pr: StagePullRequest | null;
  readonly hasUnread: boolean;
  readonly openQuestionCount: number;
  readonly fixNeedsYouCount?: number;
  readonly fixCouldntFixCount?: number;
  readonly noteNeedsYouCount?: number;
  readonly noteCouldntFixCount?: number;
  readonly hasBlockedAgent?: boolean;
  readonly isBranchless?: boolean;
  readonly hasPlanWaiting?: boolean;
};

const ATTENTION_PRIORITY: ReadonlyArray<SessionAttentionReason> = [
  'needs-approval',
  'agent-error',
  'plan-approval',
  'open-question',
  'fix-needs-you',
  'ci-failed',
  'changes-requested',
  'fix-couldnt-fix',
  'pr-queued',
  'pr-approved',
  'unread-reply',
];

const HUMAN_INPUT_REASONS: ReadonlyArray<SessionAttentionReason> = [
  'needs-approval',
  'plan-approval',
  'open-question',
  'fix-needs-you',
];

type ReasonParams = {
  readonly reason: SessionAttentionReason;
};

export const isHumanInputReason = ({ reason }: ReasonParams): boolean =>
  HUMAN_INPUT_REASONS.includes(reason);

const isPrLive = (pr: StagePullRequest | null): pr is StagePullRequest =>
  pr !== null && pr.state !== 'merged' && pr.state !== 'closed';

const NO_REASONS: ReadonlyArray<SessionAttentionReason> = [];

const interned = new Map<string, ReadonlyArray<SessionAttentionReason>>();

type InternParams = {
  readonly reasons: ReadonlyArray<SessionAttentionReason>;
};

export const internReasons = ({ reasons }: InternParams): ReadonlyArray<SessionAttentionReason> => {
  if (reasons.length === 0) {
    return NO_REASONS;
  }
  const key = reasons.join(',');
  const known = interned.get(key);
  if (known !== undefined) {
    return known;
  }
  interned.set(key, reasons);
  return reasons;
};

export const attentionFactsOf = ({
  session,
  pr,
  hasUnread,
  openQuestionCount,
  fixNeedsYouCount = 0,
  fixCouldntFixCount = 0,
  noteNeedsYouCount = 0,
  noteCouldntFixCount = 0,
  hasBlockedAgent = false,
  isBranchless = false,
  hasPlanWaiting = false,
}: AttentionFactsParams): ReadonlyArray<SessionAttentionReason> => {
  const isOnBranch = !isBranchless;
  const livePr = isOnBranch && isPrLive(pr) ? pr : null;
  const holds: Record<SessionAttentionReason, boolean> = {
    'needs-approval': hasBlockedAgent,
    'agent-error': session.state.kind === 'error',
    'plan-approval': hasPlanWaiting,
    'open-question': openQuestionCount > 0,
    'fix-needs-you': isOnBranch && fixNeedsYouCount + noteNeedsYouCount > 0,
    'ci-failed': livePr !== null && livePr.checks === 'failure',
    'changes-requested': livePr !== null && livePr.reviewDecision === 'changes_requested',
    'fix-couldnt-fix': isOnBranch && fixCouldntFixCount + noteCouldntFixCount > 0,
    'pr-queued': livePr !== null && livePr.state === 'queued',
    'pr-approved': livePr !== null && isPullRequestApproved({ pr: livePr }),
    'unread-reply': hasUnread,
  };
  return internReasons({ reasons: ATTENTION_PRIORITY.filter((reason) => holds[reason]) });
};
