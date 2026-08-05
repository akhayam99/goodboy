import type { Agent, ModelEffort, ProviderId } from '@goodboy/types';
import { EFFORT_LEVELS } from '../chat/utils/chat-constants';

type Params = {
  readonly agent: Agent | null;
  readonly modelOverride: string | null;
  readonly providerOverride: ProviderId | null;
  readonly effortOverride: string | null;
};

export const agentRoutingOverrides = ({
  agent,
  modelOverride,
  providerOverride,
  effortOverride,
}: Params): {
  readonly agentModel: string | null;
  readonly agentProvider: ProviderId | null;
  readonly agentEffort: ModelEffort | null;
} => {
  const effort = effortOverride ?? agent?.effort ?? null;
  return {
    agentModel: modelOverride ?? agent?.modelOverride ?? null,
    agentProvider: providerOverride ?? agent?.providerOverride ?? null,
    agentEffort: EFFORT_LEVELS.find((level) => level === effort) ?? null,
  };
};
