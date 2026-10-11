import { clampEffortForModel, type Resolution } from '@goodboy/core';
import type { AgentEffort } from '@goodboy/types';
import type { AgentSpawnConfigValue } from './agentSpawnConfigValue';

const TASK_FALLBACK_EFFORT: AgentEffort = 'medium';

type Params = {
  readonly resolution: Resolution;
};

export const taskModelAgentSpawnConfig = ({ resolution }: Params): AgentSpawnConfigValue => {
  const requestedEffort = resolution.effort ?? TASK_FALLBACK_EFFORT;
  return {
    hint: '',
    provider: resolution.provider,
    model: resolution.model,
    effort:
      clampEffortForModel({
        model: resolution.model,
        effort: requestedEffort,
        provider: resolution.provider,
      }) ?? requestedEffort,
  };
};
