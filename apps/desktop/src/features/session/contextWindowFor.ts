import { getModelDescriptor } from '@goodboy/core';

export const contextWindowFor = (model: string): number | null => {
  return getModelDescriptor(model)?.contextWindow ?? null;
};
