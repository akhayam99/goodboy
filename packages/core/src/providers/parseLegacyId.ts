import type { EffortLevel, ModelSelection, ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly id: string;
  readonly effort?: EffortLevel;
};

const LEGACY_SELECTIONS: Readonly<Record<string, ModelSelection>> = {
  'anthropic:claude-opus-5': { key: 'opus-5' },
  'anthropic:claude-fable-5': { key: 'fable-5' },
  'anthropic:claude-opus-4-8': { key: 'opus-4.8' },
  'anthropic:claude-opus-4-7': { key: 'opus-4.7' },
  'anthropic:claude-opus-4-6': { key: 'opus-4.6' },
  'anthropic:claude-sonnet-4-6': { key: 'sonnet-4.6' },
  'anthropic:claude-sonnet-4-5': { key: 'sonnet-4.5' },
  'anthropic:claude-haiku-4-5': { key: 'haiku-4.5' },
  'cursor:composer-2': {
    key: 'composer-2.5',
    toggles: { thinking: false, fast: false },
  },
  'cursor:composer-2-fast': {
    key: 'composer-2.5',
    toggles: { thinking: false, fast: true },
  },
  'cursor:auto': { key: 'auto', toggles: { thinking: false, fast: false } },
  'cursor:claude-opus-4-7-thinking-high': {
    key: 'opus-4.7',
    effort: 'high',
    toggles: { thinking: true, fast: false },
  },
  'cursor:claude-4.6-sonnet-high': {
    key: 'sonnet-4.6',
    effort: 'high',
    toggles: { thinking: false, fast: false },
  },
  'cursor:claude-4.6-sonnet-medium': {
    key: 'sonnet-4.6',
    effort: 'medium',
    toggles: { thinking: false, fast: false },
  },
  'cursor:gpt-5.5-high': {
    key: 'gpt-5.5',
    effort: 'high',
    toggles: { thinking: false, fast: false },
  },
  'cursor:gpt-5.5-medium': {
    key: 'gpt-5.5',
    effort: 'medium',
    toggles: { thinking: false, fast: false },
  },
  'cursor:gpt-5.3-codex': {
    key: 'gpt-5.3-codex',
    toggles: { thinking: false, fast: false },
  },
  'codex:gpt-5.6': { key: 'gpt-5.6', variant: 'sol' },
  'codex:gpt-5.5': { key: 'gpt-5.5', variant: 'default' },
  'codex:gpt-5.4': { key: 'gpt-5.4', variant: 'default' },
  'codex:gpt-5.2': { key: 'gpt-5.4', variant: 'default' },
  'codex:gpt-5.3-codex': { key: 'gpt-5.4', variant: 'default' },
  'codex:gpt-5.3-codex-spark': { key: 'gpt-5.4-mini', variant: 'default' },
  'codex:gpt-5.4-mini': { key: 'gpt-5.4-mini', variant: 'default' },
  'gemini:gemini-3.1-pro': { key: 'gemini-3.1-pro' },
  'gemini:gemini-3.5-flash': { key: 'gemini-3.5-flash' },
  'opencode:opencode/big-pickle': { key: 'big-pickle' },
  'opencode:opencode/deepseek-v4-flash-free': { key: 'ring-2.6-1t' },
  'opencode:opencode/minimax-m3-free': { key: 'minimax-m2.5' },
  'opencode:opencode/nemotron-3-super-free': { key: 'nemotron-3-super' },
  'openrouter:openrouter/anthropic/claude-sonnet-4.5': { key: 'sonnet-4.5' },
  'openrouter:openrouter/anthropic/claude-opus-4.8': { key: 'opus-4.8' },
  'openrouter:openrouter/openai/gpt-5.4': { key: 'gpt-5.4' },
  'openrouter:openrouter/google/gemini-3.1-pro': { key: 'gemini-3.1-pro' },
  'openrouter:openrouter/deepseek/deepseek-v4': { key: 'deepseek-v4' },
  'openrouter:openrouter/moonshotai/kimi-k2': { key: 'kimi-k2' },
  'openrouter:openrouter/z-ai/glm-5': { key: 'glm-5' },
  'openrouter:openrouter/x-ai/grok-4': { key: 'grok-4' },
};

export const parseLegacyId = ({ provider, id, effort }: Params): ModelSelection | null => {
  const selection = LEGACY_SELECTIONS[`${provider}:${id}`];
  if (selection == null) {
    return null;
  }
  if (effort == null || selection.effort != null) {
    return selection;
  }
  return { ...selection, effort };
};
