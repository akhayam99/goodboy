import type { ModelKey, ModelRoutingProfile, ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
};

const EXPLORATION_LIGHT: ModelRoutingProfile = {
  taskTypes: ['exploration'],
  preferredDifficulty: ['light'],
  evidence: 'curated',
};

const PLANNING_HEAVY: ModelRoutingProfile = {
  taskTypes: ['planning'],
  preferredDifficulty: ['heavy', 'standard'],
  evidence: 'curated',
};

const DELIVERY_STANDARD: ModelRoutingProfile = {
  taskTypes: ['implementation', 'debugging', 'review', 'testing', 'general'],
  preferredDifficulty: ['standard'],
  evidence: 'curated',
};

const CURATED_PROFILES: Readonly<Record<string, ModelRoutingProfile>> = {
  'anthropic:haiku-4.5': EXPLORATION_LIGHT,
  'anthropic:opus-5': PLANNING_HEAVY,
  'anthropic:sonnet-5': DELIVERY_STANDARD,
};

export const workflowModelProfile = ({ provider, model }: Params): ModelRoutingProfile | null => {
  const profile = CURATED_PROFILES[`${provider}:${model}`];
  if (profile == null) {
    return null;
  }
  return profile;
};
