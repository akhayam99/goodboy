import { resolveTaskModel, clampEffortForModel } from '@goodboy/core';
import type { AuxTaskId, ProviderId, TaskModelPreferences } from '@goodboy/types';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';
import { DEFAULT_AGENT_SPAWN_CONFIG } from './defaultAgentSpawnConfig';

type Params = {
  readonly task: AuxTaskId;
  readonly preferences: TaskModelPreferences | null | undefined;
  readonly workspaceDefaultProviderId: ProviderId | null | undefined;
  readonly sessionDefaultProviderId: ProviderId;
};

export const taskModelAgentSpawnConfig = ({
  task,
  preferences,
  workspaceDefaultProviderId,
  sessionDefaultProviderId,
}: Params): AgentSpawnConfigValue => {
  const taskModel = resolveTaskModel({
    task,
    preferences,
    workspaceDefaultProviderId,
    sessionDefaultProviderId,
  });
  const requestedEffort = taskModel.effort ?? DEFAULT_AGENT_SPAWN_CONFIG.effort;
  return {
    ...DEFAULT_AGENT_SPAWN_CONFIG,
    provider: taskModel.providerId,
    model: taskModel.model,
    effort:
      clampEffortForModel({ model: taskModel.model, effort: requestedEffort }) ?? requestedEffort,
  };
};
