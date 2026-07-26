import { describe, expect, it } from 'vitest';
import { OPENROUTER_MODELS } from './constants';

describe('OPENROUTER_MODELS', () => {
  it('contains the curated pre-slugged catalog', () => {
    expect(OPENROUTER_MODELS.map((model) => model.id)).toEqual([
      'openrouter/anthropic/claude-sonnet-4.5',
      'openrouter/anthropic/claude-opus-4.8',
      'openrouter/openai/gpt-5.4',
      'openrouter/google/gemini-3.1-pro',
      'openrouter/deepseek/deepseek-v4',
      'openrouter/moonshotai/kimi-k2',
      'openrouter/z-ai/glm-5',
      'openrouter/x-ai/grok-4',
    ]);
  });

  it('maps wrapped model families and disables effort variants', () => {
    expect(OPENROUTER_MODELS.slice(0, 4).map((model) => model.family)).toEqual([
      'claude',
      'claude',
      'gpt',
      'gemini',
    ]);
    expect(OPENROUTER_MODELS.every((model) => model.effort === null)).toBe(true);
  });
});
