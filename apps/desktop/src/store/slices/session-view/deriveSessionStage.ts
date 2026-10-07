import type { SessionAttentionReason, SessionPrFetchState, SessionStageInfo } from '@goodboy/types';
import {
  attentionFactsOf,
  internReasons,
  isHumanInputReason,
  type AttentionFactsParams,
} from './attentionFactsOf';

type Params = AttentionFactsParams & {
  readonly hasRunningAgent?: boolean;
  readonly isDecidingWorkflow?: boolean;
  readonly isPrReview?: boolean;
  readonly requestLabel?: string;
  readonly prFetchState?: SessionPrFetchState;
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
};

const REASON_TEXT: Record<SessionAttentionReason, (params: ReasonTextParams) => string> = {
  'needs-approval': () => 'Needs approval',
  'agent-error': () => 'agent errored',
  'plan-approval': () => 'plan waiting for approval',
  'open-question': ({ openQuestionCount }) =>
    openQuestionCount === 1 ? '1 open question' : `${openQuestionCount} open questions`,
  'fix-needs-you': ({ fixNeedsYouCount }) =>
    fixNeedsYouCount === 1 ? '1 comment needs you' : `${fixNeedsYouCount} comments need you`,
  'ci-failed': ({ label }) => `${label}: checks failing`,
  'changes-requested': ({ label }) => `${label}: changes requested`,
  'fix-couldnt-fix': ({ fixCouldntFixCount }) =>
    fixCouldntFixCount === 1
      ? "1 comment couldn't be fixed"
      : `${fixCouldntFixCount} comments couldn't be fixed`,
  'pr-approved': ({ label }) => `${label} approved, ready to merge`,
  'unread-reply': () => 'unread agent reply',
};

const deriveStage = (params: Params): StageWithoutRequest => {
  const {
    session,
    pr,
    openQuestionCount,
    fixNeedsYouCount = 0,
    fixCouldntFixCount = 0,
    hasRunningAgent = false,
    isDecidingWorkflow = false,
    isPrReview = false,
    requestLabel,
    prFetchState = 'known',
    remainingWork = 0,
    remainingReason = null,
    hasRun = true,
    isBranchless = false,
  } = params;
  const label = requestLabel ?? (pr === null ? '' : `PR #${pr.number}`);
  const [winner] = attentionFactsOf(params);
  const isLive = hasRunningAgent || isDecidingWorkflow;
  const reasonText = (reason: SessionAttentionReason): string =>
    REASON_TEXT[reason]({ label, openQuestionCount, fixNeedsYouCount, fixCouldntFixCount });
  if (
    winner !== undefined &&
    (winner === 'agent-error' || isHumanInputReason({ reason: winner }))
  ) {
    return {
      stage: 'attention',
      reason: reasonText(winner),
      attention: winner,
      isRunning: winner !== 'agent-error' && isLive,
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
  if (winner !== undefined) {
    return { stage: 'attention', reason: reasonText(winner), attention: winner };
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
    return { stage: 'building', reason: 'checking GitHub', attention: null };
  }
  if (pr === null && prFetchState === 'unreachable') {
    return { stage: 'building', reason: 'GitHub unreachable', attention: null };
  }
  if (pr === null) {
    return hasRun
      ? { stage: 'building', reason: 'no PR yet', attention: null, isStageDefault: true }
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
  };
};
