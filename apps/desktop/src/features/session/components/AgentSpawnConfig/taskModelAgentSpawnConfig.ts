import { resolveTaskModel } from '@goodboy/core';
import type { AuxTaskId, ProviderId, TaskModelPreferences } from '@goodboy/types';
import { clampEffort } from '../../../chat/utils/chat-constants';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';
import { DEFAULT_AGENT_SPAWN_CONFIG } from './defaultAgentSpawnConfig';

type Params = {
  readonly task: AuxTaskId;
  readonly preferences: TaskModelPreferences | null | undefined;
  readonly defaultProviderId: ProviderId;
};

export const taskModelAgentSpawnConfig = ({
  task,
  preferences,
  defaultProviderId,
}: Params): AgentSpawnConfigValue => {
  const taskModel = resolveTaskModel(task, preferences, defaultProviderId);
  return {
    ...DEFAULT_AGENT_SPAWN_CONFIG,
    provider: taskModel.providerId,
    model: taskModel.model,
    effort: clampEffort(taskModel.model, DEFAULT_AGENT_SPAWN_CONFIG.effort),
  };
};
