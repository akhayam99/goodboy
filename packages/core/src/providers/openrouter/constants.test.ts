import { describe, expect, it } from 'vitest';
import { OPENROUTER_MODELS } from './constants';

describe('OPENROUTER_MODELS', () => {
  it('contains the curated pre-slugged catalog', () => {
    expect(OPENROUTER_MODELS.map((model) => model.id)).toEqual([
      'sonnet-4.5',
      'opus-4.8',
      'gpt-5.4',
      'gemini-3.1-pro',
      'deepseek-v4',
      'kimi-k2',
      'glm-5',
      'grok-4',
    ]);
  });

  it('maps wrapped model families and exposes effort variants', () => {
    expect(OPENROUTER_MODELS.slice(0, 4).map((model) => model.family)).toEqual([
      'claude',
      'claude',
      'gpt',
      'gemini',
    ]);
    expect(OPENROUTER_MODELS.every((model) => model.effort?.includes('medium') === true)).toBe(
      true,
    );
  });
});
