import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { extractStepDone, fallbackStepOutputSummary } from '@goodboy/core';
import { updateSessionWorkflowStep } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { composeStepBoundary } from '../../kickoff';
import { summarizeAgentOutput } from '../../summarizeAgentOutput';
import { isHandsFree } from './handsFree';
import type { GetFn, SetFn } from './types';

const MAX_CONTINUE = 1;

const continueAttempts = new Map<string, number>();

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
  void get().sendTurn({ sessionId, agentId, content });
};

export const finalizeWorkflowStep = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    agentId: AgentId,
    assistantText: string,
    planCapturedThisTurn: boolean,
    opts?: { readonly force?: boolean },
  ): Promise<{ readonly shouldAutoAdvance: boolean }> => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = runs.find((r) => r.id === agentId);
    if (!agent || !agent.stepId || !agent.workflowRunId) {
      return { shouldAutoAdvance: false };
    }

    const hasMarker = extractStepDone(assistantText) !== null;
    const satisfied = !!opts?.force || hasMarker || planCapturedThisTurn;
    if (!satisfied) {
      const handsFree = isHandsFree(get, sessionId, agent.workflowRunId);
      const attempts = continueAttempts.get(agentId) ?? 0;
      if (handsFree && attempts < MAX_CONTINUE) {
        continueAttempts.set(agentId, attempts + 1);
        startStep(set, get, sessionId, agentId, composeStepContinue(agentId));
      } else {
        continueAttempts.delete(agentId);
        await invokeAgentUpdateStatus(agentId, { status: 'failed', completedAt: nowIso() });
        const stalled = await invokeAgentList(sessionId);
        set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: stalled } }));
        void get().refreshUnreadWorkspaces();
        void get().emitNotification(
          'error',
          'warning',
          `step paused: ${agent.name}`,
          handsFree
            ? 'the agent stopped before emitting a step-done marker. open the agent and continue manually.'
            : 'hands-free is off, so this step will not continue on its own. open the agent and continue manually, or enable hands-free.',
          { sessionId },
        );
      }
      return { shouldAutoAdvance: false };
    }

    continueAttempts.delete(agentId);
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const outputSummary =
      session == null
        ? fallbackStepOutputSummary({ output: assistantText })
        : await summarizeAgentOutput({
            output: assistantText,
            providerId: session.providerPreference.defaultProvider,
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
