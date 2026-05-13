import type { ModelTier } from '@kay-am/types';
import { CURSOR_CHEAP_MODEL } from './cost';

// Cursor CLI v2026.05.07 default model.
export const CURSOR_DEFAULT_MODEL = 'composer-2';

// Curated subset of `cursor-agent models` output (probed live, May 2026).
// Cursor surfaces 50+ aliases; we pick the canonical "premium turn" and
// "fast cheap" representatives for each underlying family.
export const CURSOR_MODELS: ReadonlyArray<ModelTier> = [
  { id: 'composer-2', tier: 'turn', contextWindow: 200_000 },
  { id: 'claude-opus-4-7-thinking-high', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'claude-4.6-opus-high-thinking', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'claude-4.6-sonnet-medium', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'gpt-5.5-high', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'gpt-5.5-medium', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'gpt-5.3-codex', tier: 'turn', contextWindow: 200_000 },
  { id: CURSOR_CHEAP_MODEL, tier: 'cheap', contextWindow: 200_000 },
  { id: 'auto', tier: 'cheap', contextWindow: 200_000 },
];
