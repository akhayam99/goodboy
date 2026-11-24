import type { WorkflowModelPick } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import type { ProviderCooldowns } from '../../../../features/providers/routing';
import { formatClock } from '../../../../shared/utils/time/formatClock';

type Params = {
  readonly pick: WorkflowModelPick;
  readonly cooldowns: ProviderCooldowns;
  readonly reason: string;
  readonly nowMs: number;
};

export const agentLockWait = ({ pick, cooldowns, reason, nowMs }: Params): string => {
  const until = cooldowns[pick.provider];
  if (until === undefined || until <= nowMs) {
    return reason;
  }
  return `${PROVIDER_LABEL[pick.provider]} is cooling down until ${formatClock({ at: until })}. This agent keeps its model, so send it again then.`;
};
