import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { extractStepDone } from '@goodboy/core';
import { updateSessionWorkflowStep } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { composeStepBoundary } from '../../kickoff';
import { resumeClusterChildren, unsettledClusterChildren } from './clusterImplementation';
import { continueOrPause, resetContinueAttempts } from './autoContinue';
import { holdForUserQuestion } from './holdForUserQuestion';
import type { GetFn, SetFn } from './types';
import { summarizeWorkflowAgentOutput } from './summarizeWorkflowAgentOutput';
import { pendingMountContinuations } from '../turn/mountContinuations';

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const composeStepContinue = (agentId: AgentId): string =>
  [
    'You stopped before finishing this workflow step.',
    'Continue with the remaining work now.',
    composeStepBoundary(agentId),
  ].join('\n');

const startStep = (
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  agentId: AgentId,
  content: string,
): void => {
  set((s) => ({
    agentTurnState: {
      ...s.agentTurnState,
      [agentId]: { kind: 'idle' as const, lastActivityAt: nowIso() },
    },
  }));
  void get().sendTurn({ sessionId, agentId, content, origin: 'workflow' });
};

export const finalizeWorkflowStep = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    agentId: AgentId,
    assistantText: string,
    planCapturedThisTurn: boolean,
    opts?: { readonly force?: boolean; readonly didAgentDie?: boolean },
  ): Promise<{ readonly shouldAutoAdvance: boolean }> => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = runs.find((r) => r.id === agentId);
    if (!agent || !agent.stepId || !agent.workflowRunId) {
      return { shouldAutoAdvance: false };
    }
    if (pendingMountContinuations({ sessionId }).length > 0) {
      return { shouldAutoAdvance: false };
    }

    const unsettledChildren = unsettledClusterChildren(runs, agentId);
    if (unsettledChildren.length > 0) {
      const resumed = await resumeClusterChildren({ set, get, sessionId, container: agent });
      if (!resumed) {
        void get().emitNotification({
          kind: 'error',
          severity: 'warning',
          title: `${agent.name} is waiting on subagents`,
          body: `${unsettledChildren.length} ${unsettledChildren.length === 1 ? 'subagent has' : 'subagents have'} not finished, so this step stays open. open the subagents and continue them.`,
          sessionId,
        });
      }
      return { shouldAutoAdvance: false };
    }

    const markerId = extractStepDone(assistantText)?.id ?? null;
    const claimsAnotherStep =
      markerId !== null && markerId !== agentId && runs.some((r) => r.id === markerId);
    const hasMarker = markerId !== null && !claimsAnotherStep;
    const satisfied = !!opts?.force || hasMarker || planCapturedThisTurn;
    if (!satisfied) {
      if (await holdForUserQuestion({ set, get, sessionId, agent, assistantText })) {
        return { shouldAutoAdvance: false };
      }
      await continueOrPause({
        set,
        get,
        sessionId,
        agent,
        workflowRunId: agent.workflowRunId,
        unit: 'step',
        didAgentDie: opts?.didAgentDie === true,
        restart: () => startStep(set, get, sessionId, agentId, composeStepContinue(agentId)),
      });
      return { shouldAutoAdvance: false };
    }

    resetContinueAttempts({ set, get, agentId });
    const outputSummary = await summarizeWorkflowAgentOutput({
      set,
      get,
      sessionId,
      agent,
      output: assistantText,
    });
    await invokeAgentUpdateStatus(agentId, {
      status: 'completed',
      outputSummary,
      completedAt: nowIso(),
    });
    const refreshed = await invokeAgentList(sessionId);
    const workflowRunId = agent.workflowRunId;
    const ordinal = agent.ordinal;
    set((state) => {
      const target = state.sessions.find((s) => s.id === sessionId);
      const runId = target?.workflowRuns.some((r) => r.id === workflowRunId) ? workflowRunId : null;
      if (runId) {
        void updateSessionWorkflowStep(tauriDatabase, sessionId, runId, ordinal, nowIso());
      }
      return {
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
        sessions: state.sessions.map((s) => {
          if (s.id !== sessionId || !runId) {
            return s;
          }
          return {
            ...s,
            workflowRuns: s.workflowRuns.map((r) =>
              r.id === runId ? { ...r, currentStep: ordinal } : r,
            ),
          };
        }),
      };
    });
    void get().refreshUnreadWorkspaces();
    return { shouldAutoAdvance: true };
  };
};
