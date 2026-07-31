import type { EffortLevel, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { EFFORT_ORDER } from './effortOrder';

type Params = {
  readonly provider: ProviderId;
  readonly model?: string;
};

export const providerEffortLevels = ({ provider, model }: Params): ReadonlyArray<EffortLevel> => {
  const models = PROVIDER_CAPABILITIES[provider].models;
  const scoped = model != null ? models.filter((candidate) => candidate.id === model) : models;
  const available = new Set<EffortLevel>(scoped.flatMap((candidate) => candidate.effort ?? []));
  return EFFORT_ORDER.filter((level) => available.has(level));
};
