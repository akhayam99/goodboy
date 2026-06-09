import { getModelDescriptor } from '@goodboy/core';
import type { VerbosityLevel } from '../../settings/verbosity';

export const MODEL_COST_DOT: Record<string, string> = {
  cheap: 'bg-emerald-400',
  mid: 'bg-amber-400',
  premium: 'bg-rose-400',
};

export const VERBOSITY_DOT: Record<VerbosityLevel, string> = {
  brief: 'bg-emerald-400',
  normal: 'bg-amber-400',
  verbose: 'bg-rose-400',
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

export const POPUP_BASE =
  'absolute left-0 z-50 w-full rounded-md border border-border bg-subtle py-0.5 shadow-lg';
export const POPUP_DOWN = 'top-full mt-1';
export const POPUP_UP = 'bottom-full mb-1';
