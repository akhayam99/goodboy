import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import type { AppState } from '../../types';
import { sessionRequestFetchOf } from '../review-source/sessionRequestFetchOf';
import { liveWorkOfSession } from '../../runtime/live-work/selectLiveWork';
import { summarizeMountWork } from '../project-mounts/mountCompletion';
import { resolveAttentionOf } from '../resolve/resolveAttention';
import type { AutoViewState } from '../auto-view/state';
import { isRunHeldForPlan } from '../workflows/workflowPlanApproval';
import { attentionSinceOf } from './attentionSinceOf';
import { attentionWaitsOf } from './attentionWaitsOf';
import { deferredReasonsOf } from './deferredReasonsOf';
import { deriveSessionStage } from './deriveSessionStage';
import { isPrReviewSession } from './isPrReviewSession';
import { sessionHasUnread } from './sessionHasUnread';
import { resolveSessionRequest } from './resolveSessionRequest';
import { sessionStageRequestOf } from './sessionStageRequest';
import { settledOutcomeOf } from './settledOutcomeOf';

export type StageInfoState = Pick<
  AppState,
  | 'sessions'
  | 'workspaces'
  | 'projects'
  | 'sessionBranches'
  | 'sessionWorktrees'
  | 'sessionProjectMounts'
  | 'sessionMounts'
  | 'sessionActiveMount'
  | 'sessionActiveProject'
  | 'mountGithub'
  | 'mountGitlabMr'
  | 'mountBitbucketPr'
  | 'prSeries'
  | 'sessionGithub'
  | 'sessionGitlabMr'
  | 'sessionOpenQuestions'
  | 'sessionPhaseRuns'
  | 'orchestratingWorkflowRuns'
  | 'selectedAgentId'
  | 'currentSessionId'
  | 'githubStatus'
  | 'workspaceIntegrations'
  | 'hostReachability'
  | 'agentTurnState'
> &
  Partial<
    Pick<
      AppState,
      | 'sessionResolveThreads'
      | 'sessionResolveAttempts'
      | 'phaseTemplates'
      | 'sessionWorkflows'
      | 'agentKindOverride'
      | 'sessionSlackDrafts'
      | 'sessionDismissedNextSteps'
      | 'sessionArtifacts'
    > &
      AutoViewState
  >;

function countOpenQuestions(state: StageInfoState, sessionId: SessionId): number {
  const questions = state.sessionOpenQuestions[sessionId];
  if (!questions) {
    return 0;
  }
  return questions.filter((q) => q.status === 'open').length;
}

function sessionHasRunIn(state: StageInfoState, sessionId: SessionId): boolean {
  const runs = state.sessionPhaseRuns[sessionId];
  return runs === undefined || runs.length > 0;
}

export const stageInfoOf = (state: StageInfoState, session: Session): SessionStageInfo => {
  const sessionId = session.id as SessionId;
  const isBranchless = isBranchlessSession({
    branch: state.sessionBranches[sessionId],
  });
  const request =
    sessionStageRequestOf({ state, sessionId }) ??
    resolveSessionRequest({
      pr: state.sessionGithub[sessionId]?.pr ?? null,
      mr: state.sessionGitlabMr[sessionId]?.mr ?? null,
    });
  const live = liveWorkOfSession({ state, session });
  const work = summarizeMountWork({ state, sessionId });
  const attention = resolveAttentionOf({
    threads: state.sessionResolveThreads?.[sessionId] ?? [],
    attempts: state.sessionResolveAttempts?.[sessionId] ?? [],
  });
  const waits = attentionWaitsOf({ state, session });
  const requestFetch = sessionRequestFetchOf({ state, sessionId });
  const info = deriveSessionStage({
    session,
    pr: request.pr,
    requestLabel: request.requestLabel,
    remainingWork: work.remaining,
    remainingReason: work.reason,
    prFetchState: requestFetch.state,
    requestHost: requestFetch.host,
    hasUnread: sessionHasUnread({ state, sessionId }),
    openQuestionCount: countOpenQuestions(state, sessionId),
    fixNeedsYouCount: attention.needsYou,
    fixCouldntFixCount: attention.couldntFix,
    pushFailedCount: attention.pushFailed,
    noteNeedsYouCount: attention.notesNeedYou,
    noteCouldntFixCount: attention.notesCouldntFix,
    hasRunningAgent: live.isRunning,
    hasBlockedAgent: live.isBlocked,
    isDecidingWorkflow: live.isDeciding,
    isPrReview: isPrReviewSession({ agents: state.sessionPhaseRuns[sessionId] ?? [] }),
    isBranchless,
    hasRun: sessionHasRunIn(state, sessionId),
    settledOutcome: settledOutcomeOf({
      agents: state.sessionPhaseRuns[sessionId] ?? [],
      artifacts: state.sessionArtifacts?.[sessionId] ?? [],
      isBranchless,
    }),
    hasPlanWaiting: session.workflowRuns.some(
      (run) => run.discardedAt == null && isRunHeldForPlan({ run }),
    ),
    ...waits,
    deferredReasons: deferredReasonsOf({
      dismissed: state.sessionDismissedNextSteps?.[sessionId],
      pr: request.pr,
    }),
  });
  return {
    ...info,
    attentionSince: attentionSinceOf({ state, session, reason: info.attention }),
  };
};
