import type { ModelTier } from '@kay-am/types';

// OpenCode is provider-agnostic and accepts any `provider/model` id its auth
// layer has access to (run `opencode models` to see the full list). The curated
// set below is what we surface in the kAY.am UI by default; users can add custom
// ids via the per-agent model picker.
export const OPENCODE_DEFAULT_MODEL = 'github-copilot/claude-sonnet-4.6';
export const OPENCODE_CHEAP_MODEL = 'github-copilot/claude-haiku-4.5';

export const OPENCODE_MODELS: ReadonlyArray<ModelTier> = [
  { id: 'github-copilot/claude-opus-4.7', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'github-copilot/claude-opus-4.6', tier: 'turn', contextWindow: 200_000 },
  { id: OPENCODE_DEFAULT_MODEL, tier: 'turn', contextWindow: 200_000 },
  { id: 'github-copilot/gpt-5.4', tier: 'turn', contextWindow: 200_000 },
  { id: 'github-copilot/gpt-5.3-codex', tier: 'turn', contextWindow: 200_000 },
  { id: 'github-copilot/gemini-3.1-pro-preview', tier: 'turn', contextWindow: 1_000_000 },
  { id: OPENCODE_CHEAP_MODEL, tier: 'cheap', contextWindow: 200_000 },
];
