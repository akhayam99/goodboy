import { getModelDescriptor } from '@goodboy/core/providers';

export const contextWindowFor = (model: string): number | null => {
  return getModelDescriptor({ id: model })?.contextWindow ?? null;
};
