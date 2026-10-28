import { modelIdForSelection, resolveStoredModelSelection } from '@goodboy/core';
import type { EffortLevel, OrchestratorRouting, ProviderId } from '@goodboy/types';
import type { AgentKindRouting } from '../agent-kind';

export type RunModelPin = Readonly<{
  provider: ProviderId;
  model: string;
  effort: EffortLevel;
}>;

type PinParams = {
  readonly pin: RunModelPin;
};

export const agentRoutingOfPin = ({ pin }: PinParams): AgentKindRouting => ({
  provider: pin.provider,
  model: pin.model,
  effort: pin.effort,
});

export const orchestratorRoutingOfPin = ({ pin }: PinParams): OrchestratorRouting => {
  const stored = resolveStoredModelSelection({ provider: pin.provider, id: pin.model });
  return {
    providerId: pin.provider,
    model:
      stored.report?.kind === 'unknown'
        ? pin.model
        : modelIdForSelection({ provider: pin.provider, selection: stored.selection }),
    effort: pin.effort,
  };
};
