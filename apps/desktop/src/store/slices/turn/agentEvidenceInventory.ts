import { renderEvidenceInventory } from '@goodboy/core';
import type { AgentId, EvidenceInventory, SessionId, WorkflowRunId } from '@goodboy/types';
import {
  buildAgentInventory,
  type AgentInventoryAssembly,
} from '../../../features/context/agentInventory';
import { invokeEvidenceInventoryRecord } from '../../../features/workflows/workflows';
import { inferAgentKindFromName, type AgentKind } from '../../../features/session/agent-kind';
import { slotsForKind } from '../../../features/providers/slot-routing';
import type { GetFn } from './types';

const issued = new Map<AgentId, AgentInventoryAssembly>();

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const assemble = ({ get, sessionId, agentId }: Params): AgentInventoryAssembly => {
  const state = get();
  const agents = (state.sessionPhaseRuns ?? {})[sessionId] ?? [];
  const agent = agents.find((candidate) => candidate.id === agentId) ?? null;
  const kind: AgentKind =
    (agent?.kind as AgentKind | undefined) ??
    (state.agentKindOverride ?? {})[agentId] ??
    inferAgentKindFromName(agent?.name ?? '');
  return buildAgentInventory({
    agentId,
    agents,
    slots: (state.sessionSlots ?? {})[sessionId] ?? [],
    deliveredSlotKeys: slotsForKind(kind) ?? [],
    plans: (state.sessionPlans ?? {})[sessionId] ?? [],
    questions: (state.sessionOpenQuestions ?? {})[sessionId] ?? [],
    holds: (state.clusterCompletionHolds ?? {})[sessionId] ?? [],
    obligations: (state.capabilityObligations ?? {})[sessionId] ?? [],
    graphs: (state.clusterExecutionGraphs ?? {})[sessionId] ?? [],
  });
};

export const issueAgentInventory = ({
  get,
  sessionId,
  agentId,
}: Params): AgentInventoryAssembly => {
  const assembly = assemble({ get, sessionId, agentId });
  issued.set(agentId, assembly);
  return assembly;
};

export const issuedAgentInventory = ({ get, sessionId, agentId }: Params): AgentInventoryAssembly =>
  issued.get(agentId) ?? assemble({ get, sessionId, agentId });

type PersistParams = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly agentId: AgentId;
  readonly inventory: EvidenceInventory;
};

export const persistAgentInventory = async ({
  sessionId,
  workflowRunId,
  agentId,
  inventory,
}: PersistParams): Promise<void> => {
  try {
    await invokeEvidenceInventoryRecord({ sessionId, workflowRunId, agentId, inventory });
  } catch {
    return;
  }
};

export const renderInventoryBlock = ({
  inventory,
}: {
  readonly inventory: EvidenceInventory;
}): string => renderEvidenceInventory({ inventory });
