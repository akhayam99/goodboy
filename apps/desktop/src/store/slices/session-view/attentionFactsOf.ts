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
  readonly pushFailedCount?: number;
  readonly noteNeedsYouCount?: number;
  readonly noteCouldntFixCount?: number;
  readonly hasBlockedAgent?: boolean;
  readonly isBranchless?: boolean;
  readonly hasPlanWaiting?: boolean;
  readonly hasStoppedRun?: boolean;
  readonly hasLimitPausedRun?: boolean;
  readonly hasRunWaitingForGo?: boolean;
  readonly hasAutoNeedsYou?: boolean;
  readonly hasSlackReplyWaiting?: boolean;
  readonly deferredReasons?: ReadonlySet<SessionAttentionReason>;
};

const ATTENTION_PRIORITY: ReadonlyArray<SessionAttentionReason> = [
  'needs-approval',
  'agent-error',
  'run-stopped',
  'push-failed',
  'plan-approval',
  'open-question',
  'run-waits-for-go',
  'auto-needs-you',
  'slack-reply-waiting',
  'fix-needs-you',
  'run-paused-at-limit',
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
  'run-waits-for-go',
  'auto-needs-you',
  'slack-reply-waiting',
  'run-paused-at-limit',
];

const ERROR_REASONS: ReadonlyArray<SessionAttentionReason> = ['agent-error', 'run-stopped'];

type ReasonParams = {
  readonly reason: SessionAttentionReason;
};

export const isHumanInputReason = ({ reason }: ReasonParams): boolean =>
  HUMAN_INPUT_REASONS.includes(reason);

export const isErrorReason = ({ reason }: ReasonParams): boolean => ERROR_REASONS.includes(reason);

const isPrLive = (pr: StagePullRequest | null): pr is StagePullRequest =>
  pr !== null && pr.state !== 'merged' && pr.state !== 'closed';

const NO_REASONS: ReadonlyArray<SessionAttentionReason> = [];

const NO_DEFERRALS: ReadonlySet<SessionAttentionReason> = new Set();

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
  pushFailedCount = 0,
  noteNeedsYouCount = 0,
  noteCouldntFixCount = 0,
  hasBlockedAgent = false,
  isBranchless = false,
  hasPlanWaiting = false,
  hasStoppedRun = false,
  hasLimitPausedRun = false,
  hasRunWaitingForGo = false,
  hasAutoNeedsYou = false,
  hasSlackReplyWaiting = false,
  deferredReasons = NO_DEFERRALS,
}: AttentionFactsParams): ReadonlyArray<SessionAttentionReason> => {
  const isOnBranch = !isBranchless;
  const livePr = isOnBranch && isPrLive(pr) ? pr : null;
  const holds: Record<SessionAttentionReason, boolean> = {
    'needs-approval': hasBlockedAgent,
    'agent-error': session.state.kind === 'error',
    'push-failed': isOnBranch && pushFailedCount > 0,
    'plan-approval': hasPlanWaiting,
    'open-question': openQuestionCount > 0,
    'fix-needs-you': isOnBranch && fixNeedsYouCount + noteNeedsYouCount > 0,
    'ci-failed': livePr !== null && livePr.checks === 'failure',
    'changes-requested': livePr !== null && livePr.reviewDecision === 'changes_requested',
    'fix-couldnt-fix': isOnBranch && fixCouldntFixCount + noteCouldntFixCount > 0,
    'pr-queued': livePr !== null && livePr.state === 'queued',
    'pr-approved': livePr !== null && isPullRequestApproved({ pr: livePr }),
    'unread-reply': hasUnread,
    'run-stopped': hasStoppedRun,
    'run-paused-at-limit': hasLimitPausedRun,
    'run-waits-for-go': hasRunWaitingForGo,
    'auto-needs-you': hasAutoNeedsYou,
    'slack-reply-waiting': hasSlackReplyWaiting,
  };
  return internReasons({
    reasons: ATTENTION_PRIORITY.filter(
      (reason) =>
        holds[reason] && !(deferredReasons.has(reason) && !isHumanInputReason({ reason })),
    ),
  });
};
