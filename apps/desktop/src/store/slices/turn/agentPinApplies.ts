import type { ProviderId } from '@goodboy/types';

type Params = {
  readonly agentModelPin: string | null;
  readonly agentProvider: ProviderId | null;
  readonly provider: ProviderId;
};

export const agentPinApplies = ({ agentModelPin, agentProvider, provider }: Params): boolean =>
  agentModelPin != null &&
  (agentProvider != null ? agentProvider === provider : provider === 'anthropic');
