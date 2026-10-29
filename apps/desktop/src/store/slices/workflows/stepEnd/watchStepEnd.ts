import type { AgentId, SessionId } from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../../features/workflows/workflows';
import { pendingMountContinuations } from '../../turn/mountContinuations';
import { isTurnActive } from '../../turn/turnSettled';
import type { GetFn, SetFn } from '../types';
import { logStepEnd } from './logStepEnd';
import { silentStepEndReason } from './silentStepEndReason';

const STEP_END_CHECK_MS = 4000;

const checks = new Map<AgentId, ReturnType<typeof setTimeout>>();

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const checkStepEnd = async ({ set, get, sessionId, agentId }: Params): Promise<void> => {
  const state = get();
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const agent = agents.find((candidate) => candidate.id === agentId);
  const reason = silentStepEndReason({
    agent,
    agents,
    turn: state.agentTurnState[agentId],
    hasActiveTurn: isTurnActive({ agentId }),
    hasPendingContinuation: pendingMountContinuations({ sessionId }).length > 0,
    questions: state.sessionOpenQuestions[sessionId] ?? [],
  });
  if (agent === undefined || reason === null) {
    return;
  }
  try {
    const completedAt = isoNow();
    await invokeAgentUpdateStatus(agentId, { status: 'blocked', completedAt });
    const refreshed = await invokeAgentList(sessionId);
    const endedAt = refreshed.find((candidate) => candidate.id === agentId)?.completedAt;
    set((current) => ({
      sessionPhaseRuns: { ...current.sessionPhaseRuns, [sessionId]: refreshed },
      silentlyEndedSteps: {
        ...current.silentlyEndedSteps,
        [agentId]: endedAt ?? completedAt,
      },
    }));
    void get().refreshUnreadWorkspaces();
    logStepEnd({ agentId, reason });
    void get().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: `${agent.name} ended without a result`,
      body: 'The agent stopped without saying it was done and without asking you anything. Continue it, or mark the step done.',
      sessionId,
    });
  } catch (error) {
    await get().reportError({ title: "Couldn't mark the step as ended", error, sessionId });
  }
};

export const watchStepEnd = ({ set, get, sessionId, agentId }: Params): void => {
  const agent = (get().sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.id === agentId,
  );
  if (agent?.stepId == null || agent.workflowRunId == null) {
    return;
  }
  const previous = checks.get(agentId);
  if (previous !== undefined) {
    clearTimeout(previous);
  }
  checks.set(
    agentId,
    setTimeout(() => {
      checks.delete(agentId);
      void checkStepEnd({ set, get, sessionId, agentId });
    }, STEP_END_CHECK_MS),
  );
};
