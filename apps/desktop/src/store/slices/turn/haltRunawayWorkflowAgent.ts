import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { NAMES } from '../../../shared/utils/names';
import { CHECK_STATE } from '../notifications/errorRecovery';
import { MAX_UNATTENDED_TURNS_PER_AGENT } from './workflowTurnBreaker';
import type { GetFn, SetFn } from './types';
import { NOT_BLOCKED } from './notBlocked';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
}>;

const RUNAWAY_SENTENCE = `Ran ${MAX_UNATTENDED_TURNS_PER_AGENT} times in an hour with no limit set.`;

export const haltRunawayWorkflowAgent = async ({ set, get, sessionId, agentId }: Params) => {
  const name =
    (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId)?.name ?? 'agent';
  try {
    await invokeAgentUpdateStatus(agentId, {
      status: 'blocked',
      completedAt: new Date().toISOString() as IsoDateTime,
    });
  } catch (error) {
    void get().reportError({
      recovery: CHECK_STATE,
      title: `Couldn't hold ${name}`,
      error,
      sessionId,
    });
    return NOT_BLOCKED;
  }
  const refreshed = await invokeAgentList(sessionId).catch(() => null);
  if (refreshed !== null) {
    set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed } }));
  }
  void get().refreshUnreadWorkspaces();
  void get().joinFanOutParent({ sessionId, agentId });
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: `${NAMES.needsYou}: ${name}`,
    body: RUNAWAY_SENTENCE,
    sessionId,
    action: { kind: 'open-agent', sessionId, agentId },
  });
  return NOT_BLOCKED;
};
