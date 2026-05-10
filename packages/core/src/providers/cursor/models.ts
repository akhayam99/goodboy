import type { ModelTier } from '@kay-am/types';
import { CURSOR_CHEAP_MODEL } from './cost';

export const CURSOR_DEFAULT_MODEL = 'claude-sonnet-4-6';

export const CURSOR_MODELS: ReadonlyArray<ModelTier> = [
  { id: 'claude-sonnet-4-6', tier: 'turn', contextWindow: 200_000 },
  { id: 'claude-sonnet-4-5', tier: 'turn', contextWindow: 200_000 },
  { id: CURSOR_CHEAP_MODEL, tier: 'cheap', contextWindow: 32_000 },
];
