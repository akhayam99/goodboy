import type { ModelTier, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel } from './capabilities';
import { getModelDescriptor } from './model-display';

type Params = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

export const resolveModelForProvider = ({ provider, modelId }: Params): string => {
  const models = PROVIDER_CAPABILITIES[provider].models;
  if (models.some((m) => m.id === modelId)) {
    return modelId;
  }
  const descriptor = getModelDescriptor(modelId);
  if (descriptor === null) {
    return getDefaultTurnModel(provider);
  }
  const sameSubfamily = models.filter(
    (m) => m.family === descriptor.family && m.subfamily === descriptor.subfamily,
  );
  const sameFamily = models.filter((m) => m.family === descriptor.family);
  const candidates = sameSubfamily.length > 0 ? sameSubfamily : sameFamily;
  if (candidates.length > 0) {
    return candidates.reduce((best, model) =>
      Math.abs(model.weight - descriptor.weight) < Math.abs(best.weight - descriptor.weight)
        ? model
        : best,
    ).id;
  }
  return getDefaultTurnModel(provider);
};
