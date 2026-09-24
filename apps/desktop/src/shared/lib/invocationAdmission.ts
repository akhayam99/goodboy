import { resolveSettings } from '@goodboy/core';
import type { EffortLevel, InvocationLimits, OverrideSettings, ProviderId } from '@goodboy/types';

type LimitsParams = {
  readonly providerId: ProviderId;
  readonly workspaceOverride: OverrideSettings | null | undefined;
};

export const resolveInvocationLimits = ({
  providerId,
  workspaceOverride,
}: LimitsParams): InvocationLimits => {
  const settings = resolveSettings({
    global: {
      defaultProviderId: providerId,
      defaultWorkflowId: null,
      defaultBranchPrefix: 'goodboy',
      parallelEnabled: false,
      defaultVerbosity: 'normal',
    },
    workspaceOverride,
  });
  return {
    global: settings.invocationGlobalLimit,
    provider: settings.invocationProviderLimit,
    heavyweight: settings.invocationHeavyweightLimit,
  };
};

type HeavyweightParams = {
  readonly effort: EffortLevel | string | null | undefined;
};

export const isHeavyweightInvocation = ({ effort }: HeavyweightParams): boolean =>
  effort === 'high' || effort === 'xhigh' || effort === 'max' || effort === 'ultra';
