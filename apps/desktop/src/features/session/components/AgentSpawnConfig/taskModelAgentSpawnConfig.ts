import { clampEffortForModel } from '@goodboy/core';
import type { AuxTaskId, ProviderId, TaskModelPreferences } from '@goodboy/types';
import type { AutoLimitContext } from '../../../../store/slices/providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../../../../store/slices/providerLimits/resolveLimitedTaskModel';
import { kindRouting } from '../../agent-kind';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';

type Params = {
  readonly task: AuxTaskId;
  readonly preferences: TaskModelPreferences | null | undefined;
  readonly workspaceDefaultProviderId: ProviderId | null | undefined;
  readonly sessionDefaultProviderId: ProviderId;
  readonly limitContext: AutoLimitContext | null;
};

export const taskModelAgentSpawnConfig = ({
  task,
  preferences,
  workspaceDefaultProviderId,
  sessionDefaultProviderId,
  limitContext,
}: Params): AgentSpawnConfigValue => {
  const taskModel = resolveLimitedTaskModel({
    limitContext,
    task,
    preferences,
    workspaceDefaultProviderId,
    sessionDefaultProviderId,
  });
  const requestedEffort = taskModel.effort ?? kindRouting({ kind: 'generic' }).effort;
  return {
    hint: '',
    provider: taskModel.providerId,
    model: taskModel.model,
    effort:
      clampEffortForModel({ model: taskModel.model, effort: requestedEffort }) ?? requestedEffort,
  };
};
