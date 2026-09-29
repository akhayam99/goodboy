import { getModelDescriptor } from '@goodboy/core';

export const contextWindowFor = (model: string): number | null => {
  return getModelDescriptor({ id: model })?.contextWindow ?? null;
};
