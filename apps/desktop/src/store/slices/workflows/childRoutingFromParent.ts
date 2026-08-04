import type { Agent, ModelEffort, Step } from '@goodboy/types';
import { EFFORT_LEVELS } from '../../../features/chat/utils/chat-constants';
import { inferAgentKindFromName, type AgentKind } from '../../../features/session/agent-kind';
import {
  resolveStepRouting,
  type StepRouting,
} from '../../../features/workflows/resolveStepRouting';
import { roleModelsForSession } from '../overrides/roleModelsForSession';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly parent: Agent;
};

const stepForParent = ({ get, parent }: Params): Step | null => {
  if (parent.stepId == null) {
    return null;
  }
  const state = get();
  const session = state.sessions.find((candidate) => candidate.id === parent.sessionId);
  if (session == null) {
    return null;
  }
  const run = session.workflowRuns.find((candidate) => candidate.id === parent.workflowRunId);
  const workflow = (state.phaseTemplates[session.workspaceId] ?? []).find(
    (candidate) => candidate.id === run?.workflowId,
  );
  return workflow?.steps.find((candidate) => candidate.id === parent.stepId) ?? null;
};

const parentEffort = ({ get, parent }: Params): ModelEffort | null => {
  const stored = get().agentEffortOverride[parent.id] ?? parent.effort;
  return EFFORT_LEVELS.find((level) => level === stored) ?? null;
};

export const childRoutingFromParent = ({ get, parent }: Params): StepRouting => {
  const state = get();
  const kind: AgentKind =
    state.agentKindOverride[parent.id] ??
    (parent.kind as AgentKind | undefined) ??
    inferAgentKindFromName(parent.name);
  return resolveStepRouting({
    step: stepForParent({ get, parent }),
    kind,
    roleModels: roleModelsForSession({ state, sessionId: parent.sessionId }),
    agentModel: state.agentModelOverride[parent.id] ?? parent.modelOverride ?? null,
    agentProvider: state.agentProviderOverride[parent.id] ?? parent.providerOverride ?? null,
    agentEffort: parentEffort({ get, parent }),
  });
};
