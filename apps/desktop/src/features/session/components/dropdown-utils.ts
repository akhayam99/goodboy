import { getModelDescriptor } from '@goodboy/core';

export const MODEL_COST_DOT: Record<string, string> = {
  cheap: 'bg-success',
  mid: 'bg-warning',
  premium: 'bg-danger',
};

export const modelCostTier = (modelId: string): 'cheap' | 'mid' | 'premium' => {
  const descriptor = getModelDescriptor(modelId);
  if (descriptor) {
    return descriptor.costTier === 'expensive' ? 'premium' : descriptor.costTier;
  }
  if (/haiku|mini|fast/i.test(modelId)) {
    return 'cheap';
  }
  if (/opus/i.test(modelId)) {
    return 'premium';
  }
  return 'mid';
};
