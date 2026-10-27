import { PULL_REQUEST_NOUNS, REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type {
  PullRequestHost,
  SessionAttentionReason,
  SessionPrFetchState,
  SessionStageInfo,
} from '@goodboy/types';
import {
  couldntFixWords,
  needsYouWords,
  pushFailedWords,
} from '../../../features/resolve/notes/attentionWords';
import {
  attentionFactsOf,
  internReasons,
  isErrorReason,
  isHumanInputReason,
  type AttentionFactsParams,
} from './attentionFactsOf';
import type { SettledOutcome } from './settledOutcomeOf';

type Params = AttentionFactsParams & {
  readonly settledOutcome?: SettledOutcome | null;
  readonly hasRunningAgent?: boolean;
  readonly isDecidingWorkflow?: boolean;
  readonly isPrReview?: boolean;
  readonly requestLabel?: string;
  readonly prFetchState?: SessionPrFetchState;
  readonly requestHost?: PullRequestHost;
  readonly remainingWork?: number;
  readonly remainingReason?: string | null;
  readonly hasRun?: boolean;
};

type StageWithoutRequest = Pick<SessionStageInfo, 'stage' | 'reason' | 'attention'> & {
  readonly isRunning?: boolean;
  readonly isStageDefault?: true;
};

type ReasonTextParams = {
  readonly label: string;
  readonly openQuestionCount: number;
  readonly fixNeedsYouCount: number;
  readonly fixCouldntFixCount: number;
  readonly pushFailedCount: number;
  readonly noteNeedsYouCount: number;
  readonly noteCouldntFixCount: number;
};

const REASON_TEXT: Record<SessionAttentionReason, (params: ReasonTextParams) => string> = {
  'needs-approval': () => 'Needs permission',
  'agent-error': () => 'agent errored',
  'push-failed': ({ pushFailedCount }) => pushFailedWords({ count: pushFailedCount }),
  'plan-approval': () => 'plan waiting for approval',
  'open-question': ({ openQuestionCount }) =>
    openQuestionCount === 1 ? '1 open question' : `${openQuestionCount} open questions`,
  'fix-needs-you': ({ fixNeedsYouCount, noteNeedsYouCount }) =>
    needsYouWords({ comments: fixNeedsYouCount, notes: noteNeedsYouCount }),
  'ci-failed': ({ label }) => `${label}: checks failing`,
  'changes-requested': ({ label }) => `${label}: changes requested`,
  'fix-couldnt-fix': ({ fixCouldntFixCount, noteCouldntFixCount }) =>
    couldntFixWords({ comments: fixCouldntFixCount, notes: noteCouldntFixCount, form: 'status' }),
  'pr-queued': ({ label }) => `${label} in the merge queue`,
  'pr-approved': ({ label }) => `${label} approved, ready to merge`,
  'unread-reply': () => 'unread agent reply',
  'run-stopped': () => 'a run stopped',
  'run-paused-at-limit': () => 'a run paused at its limit',
  'run-waits-for-go': () => 'a run waits for you to continue',
  'auto-needs-you': () => 'Auto waits for you',
  'slack-reply-waiting': () => 'a Slack reply waits for your OK',
};

const SETTLED_TEXT: Record<SettledOutcome, string> = {
  answered: 'answered',
  finished: 'finished',
  'report-ready': 'report ready',
  'plan-ready': 'plan ready',
};

const deriveStage = (params: Params): StageWithoutRequest => {
  const {
    session,
    pr,
    openQuestionCount,
    fixNeedsYouCount = 0,
    fixCouldntFixCount = 0,
    pushFailedCount = 0,
    noteNeedsYouCount = 0,
    noteCouldntFixCount = 0,
    hasRunningAgent = false,
    isDecidingWorkflow = false,
    isPrReview = false,
    requestLabel,
    prFetchState = 'known',
    requestHost = 'github',
    remainingWork = 0,
    remainingReason = null,
    hasRun = true,
    isBranchless = false,
    settledOutcome = null,
  } = params;
  const label = requestLabel ?? (pr === null ? '' : `PR #${pr.number}`);
  const facts = attentionFactsOf(params);
  const [winner] = facts;
  const isLive = hasRunningAgent || isDecidingWorkflow;
  const reasonText = (reason: SessionAttentionReason): string =>
    REASON_TEXT[reason]({
      label,
      openQuestionCount,
      fixNeedsYouCount,
      fixCouldntFixCount,
      pushFailedCount,
      noteNeedsYouCount,
      noteCouldntFixCount,
    });
  const blocker = facts.find(
    (reason) => isErrorReason({ reason }) || isHumanInputReason({ reason }),
  );
  if (blocker !== undefined && (blocker === winner || isLive)) {
    return {
      stage: 'attention',
      reason: reasonText(blocker),
      attention: blocker,
      isRunning: !isErrorReason({ reason: blocker }) && isLive,
    };
  }
  if (hasRunningAgent) {
    return {
      stage: 'running',
      reason: 'agent running',
      attention: null,
      isRunning: true,
      isStageDefault: true,
    };
  }
  if (isDecidingWorkflow) {
    return {
      stage: 'running',
      reason: 'deciding the next step',
      attention: null,
      isRunning: true,
    };
  }
  if (winner === 'pr-queued') {
    return { stage: 'review', reason: reasonText(winner), attention: winner };
  }
  if (winner !== undefined) {
    return { stage: 'attention', reason: reasonText(winner), attention: winner };
  }
  if (isBranchless && settledOutcome !== null) {
    return { stage: 'done', reason: SETTLED_TEXT[settledOutcome], attention: null };
  }
  if (isBranchless) {
    return {
      stage: 'building',
      reason: hasRun ? 'ready for work' : 'not started',
      attention: null,
    };
  }
  if (isPrReview && pr === null) {
    return { stage: 'review', reason: 'reviewing an external PR', attention: null };
  }
  if (pr === null && prFetchState === 'unknown') {
    return {
      stage: 'building',
      reason: `checking ${REVIEW_SOURCE_LABEL[requestHost]}`,
      attention: null,
    };
  }
  if (pr === null && prFetchState === 'unreachable') {
    return {
      stage: 'building',
      reason: `${REVIEW_SOURCE_LABEL[requestHost]} unreachable`,
      attention: null,
    };
  }
  if (pr === null && settledOutcome !== null) {
    return { stage: 'done', reason: SETTLED_TEXT[settledOutcome], attention: null };
  }
  if (pr === null) {
    return hasRun
      ? {
          stage: 'building',
          reason: `no ${PULL_REQUEST_NOUNS[requestHost].short} yet`,
          attention: null,
          isStageDefault: true,
        }
      : { stage: 'building', reason: 'not started', attention: null };
  }
  if (pr.state === 'merged' || pr.state === 'closed') {
    const settled = pr.state === 'merged' ? 'merged' : 'closed';
    if (remainingWork > 0) {
      return {
        stage: 'review',
        reason: `${label} ${settled}, ${remainingReason ?? `${remainingWork} still open`}`,
        attention: null,
      };
    }
    return { stage: 'done', reason: `${label} ${settled}`, attention: null };
  }
  if (pr.isDraft) {
    return { stage: 'review', reason: `draft ${label}`, attention: null };
  }
  if (pr.checks === 'pending') {
    return { stage: 'review', reason: `${label}: checks running`, attention: null };
  }
  return {
    stage: 'review',
    reason: `${label} awaiting review`,
    attention: null,
    isStageDefault: true,
  };
};

export const deriveSessionStage = (params: Params): SessionStageInfo => {
  const { isStageDefault = false, isRunning = false, ...stage } = deriveStage(params);
  return {
    ...stage,
    addsFact: !isStageDefault,
    prState: params.pr?.state ?? null,
    isRunning,
    otherReasons: internReasons({
      reasons: attentionFactsOf(params).filter((reason) => reason !== stage.attention),
    }),
    openQuestionCount: params.openQuestionCount,
    fixNeedsYouCount: params.fixNeedsYouCount ?? 0,
    fixCouldntFixCount: params.fixCouldntFixCount ?? 0,
    pushFailedCount: params.pushFailedCount ?? 0,
    noteNeedsYouCount: params.noteNeedsYouCount ?? 0,
    noteCouldntFixCount: params.noteCouldntFixCount ?? 0,
  };
};
