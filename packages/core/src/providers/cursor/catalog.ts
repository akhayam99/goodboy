import type { CursorModel } from '@goodboy/types';

export const CURSOR_CATALOG = [
  {
    key: 'composer-2.5',
    label: 'Composer 2.5',
    tier: 'turn',
    provider: 'cursor',
    combos: [
      { effort: null, thinking: false, fast: false, slug: 'composer-2.5' },
      { effort: null, thinking: false, fast: true, slug: 'composer-2.5-fast' },
    ],
  },
  {
    key: 'auto',
    label: 'Auto',
    tier: 'cheap',
    provider: 'cursor',
    combos: [{ effort: null, thinking: false, fast: false, slug: 'auto' }],
  },
  {
    key: 'opus-5',
    label: 'Opus 5',
    tier: 'turn',
    provider: 'cursor',
    combos: [
      { effort: 'low', thinking: false, fast: false, slug: 'claude-opus-5-low' },
      { effort: 'high', thinking: true, fast: false, slug: 'claude-opus-5-thinking-high' },
    ],
  },
  {
    key: 'opus-4.7',
    label: 'Opus 4.7',
    tier: 'turn',
    provider: 'cursor',
    combos: [
      {
        effort: 'high',
        thinking: true,
        fast: false,
        slug: 'claude-opus-4-7-thinking-high',
      },
    ],
  },
  {
    key: 'sonnet-4.6',
    label: 'Sonnet 4.6',
    tier: 'turn',
    provider: 'cursor',
    combos: [
      { effort: 'medium', thinking: false, fast: false, slug: 'claude-4.6-sonnet-medium' },
      {
        effort: 'medium',
        thinking: true,
        fast: false,
        slug: 'claude-4.6-sonnet-medium-thinking',
      },
    ],
  },
  {
    key: 'gpt-5.6',
    label: 'GPT-5.6',
    tier: 'turn',
    provider: 'cursor',
    combos: [{ effort: 'high', thinking: false, fast: false, slug: 'gpt-5.6-sol-high' }],
  },
  {
    key: 'gpt-5.5',
    label: 'GPT-5.5',
    tier: 'turn',
    provider: 'cursor',
    combos: [
      { effort: 'medium', thinking: false, fast: false, slug: 'gpt-5.5-medium' },
      { effort: 'high', thinking: false, fast: false, slug: 'gpt-5.5-high' },
    ],
  },
  {
    key: 'gpt-5.3-codex',
    label: 'GPT-5.3 Codex',
    tier: 'turn',
    provider: 'cursor',
    combos: [{ effort: null, thinking: false, fast: false, slug: 'gpt-5.3-codex' }],
  },
] satisfies ReadonlyArray<CursorModel>;
