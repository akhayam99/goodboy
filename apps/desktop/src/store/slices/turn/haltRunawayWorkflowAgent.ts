import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { MAX_UNATTENDED_TURNS_PER_AGENT } from './workflowTurnBreaker';
import type { GetFn, SetFn } from './types';
import { NOT_BLOCKED } from './notBlocked';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
}>;

export const haltRunawayWorkflowAgent = async ({ set, get, sessionId, agentId }: Params) => {
  const name =
    (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId)?.name ?? 'agent';
  await invokeAgentUpdateStatus(agentId, {
    status: 'blocked',
    completedAt: new Date().toISOString() as IsoDateTime,
  }).catch(() => undefined);
  const refreshed = await invokeAgentList(sessionId).catch(() => null);
  if (refreshed !== null) {
    set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed } }));
  }
  void get().refreshUnreadWorkspaces();
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: `Autorun halted: ${name}`,
    body: `the workflow sent this agent ${MAX_UNATTENDED_TURNS_PER_AGENT} turns in the last hour without you stepping in, so goodboy stopped it to protect your usage. open the agent and continue manually.`,
    sessionId,
    action: { kind: 'open-agent', sessionId, agentId },
  });
  return NOT_BLOCKED;
};
