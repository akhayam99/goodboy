import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import type { AppState } from '../../types';
import { agentHasUnread } from '../agents/agentHasUnread';
import { isSessionPrFetchable } from '../github/resolveSessionPrFetch';
import { sessionPrFetchState } from '../github/sessionPrFetchState';
import { liveWorkOfSession } from '../live-work/selectLiveWork';
import { summarizeMountWork } from '../project-mounts/mountCompletion';
import { deriveSessionStage } from './deriveSessionStage';
import { isPrReviewSession } from './isPrReviewSession';
import { resolveSessionRequest } from './resolveSessionRequest';
import { sessionStageRequestOf } from './sessionStageRequest';

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
  | 'agentTurnState'
>;

function countOpenQuestions(state: StageInfoState, sessionId: SessionId): number {
  const questions = state.sessionOpenQuestions[sessionId];
  if (!questions) {
    return 0;
  }
  return questions.filter((q) => q.status === 'open').length;
}

function sessionHasUnreadIn(state: StageInfoState, sessionId: SessionId): boolean {
  const runs = state.sessionPhaseRuns[sessionId];
  if (!runs) {
    return false;
  }
  const selected = state.selectedAgentId[sessionId] ?? null;
  const isCurrent = state.currentSessionId === sessionId;
  return runs.some((r) => agentHasUnread(r, isCurrent && r.id === selected));
}

function sessionHasRunIn(state: StageInfoState, sessionId: SessionId): boolean {
  const runs = state.sessionPhaseRuns[sessionId];
  return runs === undefined || runs.length > 0;
}

export function stageInfoOf(state: StageInfoState, session: Session): SessionStageInfo {
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
  return deriveSessionStage({
    session,
    pr: request.pr,
    requestLabel: request.requestLabel,
    remainingWork: work.remaining,
    remainingReason: work.reason,
    prFetchState: sessionPrFetchState({
      githubAvailable: state.githubStatus?.available ?? null,
      fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
      failedAt: state.sessionGithub[sessionId]?.failedAt ?? null,
      fetchable: isSessionPrFetchable({ state, sessionId }),
    }),
    hasUnread: sessionHasUnreadIn(state, sessionId),
    openQuestionCount: countOpenQuestions(state, sessionId),
    hasRunningAgent: live.isRunning,
    hasBlockedAgent: live.isBlocked,
    isDecidingWorkflow: live.isDeciding,
    isPrReview: isPrReviewSession({ agents: state.sessionPhaseRuns[sessionId] ?? [] }),
    isBranchless,
    hasRun: sessionHasRunIn(state, sessionId),
  });
}
