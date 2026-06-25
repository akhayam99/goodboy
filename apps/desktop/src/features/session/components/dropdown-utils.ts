import { getModelDescriptor } from '@goodboy/core'

export const MODEL_COST_DOT: Record<string, string> = {
  cheap: 'bg-success',
  mid: 'bg-warning',
  premium: 'bg-danger',
}

export const modelCostTier = (modelId: string): 'cheap' | 'mid' | 'premium' => {
  const descriptor = getModelDescriptor(modelId)
  if (descriptor) {
    return descriptor.costTier === 'expensive' ? 'premium' : descriptor.costTier
  }
  if (/haiku|mini|fast/i.test(modelId)) {
    return 'cheap'
  }
  if (/opus/i.test(modelId)) {
    return 'premium'
  }
  return 'mid'
}

export const POPUP_BASE =
  'absolute left-0 z-50 w-full rounded-md border border-border bg-subtle py-0.5 shadow-lg'
export const POPUP_DOWN = 'top-full mt-1'
export const POPUP_UP = 'bottom-full mb-1'
