import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';

type Params = {
  readonly store: AppStore;
  readonly sessionId: SessionId;
  readonly leadId: AgentId;
};

export const agentFamilyOf = ({ store, sessionId, leadId }: Params): ReadonlyArray<AgentId> => {
  const agents = store.sessionPhaseRuns[sessionId] ?? [];
  const lead = agents.find((agent) => agent.id === leadId);
  const delegated = (store.autoTreeViews?.[sessionId] ?? [])
    .filter((view) => view.tree.rootAgentId === leadId)
    .flatMap((view) => view.delegations.map((delegation) => delegation.childAgentId));
  const siblings = agents
    .filter(
      (agent) =>
        agent.id !== leadId &&
        (agent.parentAgentId === leadId ||
          (lead?.workflowRunId !== undefined && agent.workflowRunId === lead.workflowRunId)),
    )
    .map((agent) => agent.id);
  return [...new Set([leadId, ...delegated, ...siblings])];
};
