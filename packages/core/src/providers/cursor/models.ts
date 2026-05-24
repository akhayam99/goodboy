import type { ModelTier } from '@goodboy/types';
import { CURSOR_CHEAP_MODEL } from './cost';

// Cursor CLI v2026.05.07 default model (per `cursor-agent models` — current
// default is `composer-2.5-fast`, not the older `composer-2`).
export const CURSOR_DEFAULT_MODEL = 'composer-2.5-fast';

// Curated subset of `cursor-agent models` output (probed live, May 2026).
// Cursor surfaces ~100 aliases; this is the canonical "premium turn" and
// "fast cheap" set per underlying family. Full catalog overhaul lands in PR-B
// (CURSOR_MODELS_FULL with structured family/effort metadata).
export const CURSOR_MODELS: ReadonlyArray<ModelTier> = [
  { id: 'composer-2.5', tier: 'turn', contextWindow: 200_000 },
  { id: 'composer-2', tier: 'turn', contextWindow: 200_000 },
  { id: 'claude-opus-4-7-thinking-high', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'claude-4.6-sonnet-high', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'claude-4.6-sonnet-medium', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'gpt-5.5-high', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'gpt-5.5-medium', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'gpt-5.4-medium', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'gpt-5.3-codex', tier: 'turn', contextWindow: 400_000 },
  { id: 'gemini-3.1-pro', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'grok-4.3', tier: 'turn', contextWindow: 1_000_000 },
  { id: CURSOR_CHEAP_MODEL, tier: 'cheap', contextWindow: 200_000 },
  { id: 'auto', tier: 'cheap', contextWindow: 200_000 },
];
