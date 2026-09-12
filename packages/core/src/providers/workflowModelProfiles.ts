import type { ModelKey, ModelRoutingProfile, ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
};

const CURATED_PROFILES: Readonly<Record<string, ModelRoutingProfile>> = {};

export const workflowModelProfile = ({ provider, model }: Params): ModelRoutingProfile | null => {
  const profile = CURATED_PROFILES[`${provider}:${model}`];
  if (profile == null) {
    return null;
  }
  return profile;
};
