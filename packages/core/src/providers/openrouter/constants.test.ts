import { describe, expect, it } from 'vitest';
import { OPENROUTER_MODELS } from './constants';
import { OPENROUTER_CATALOG } from './catalog';

describe('OPENROUTER_MODELS', () => {
  it('contains the curated pre-slugged catalog', () => {
    expect(OPENROUTER_MODELS.map((model) => model.id)).toEqual([
      'sonnet-4.5',
      'opus-4.8',
      'gpt-5.4',
      'gemini-3.1-pro',
      'deepseek-v4-pro',
      'kimi-k2',
      'glm-5',
      'grok-4.7',
      'opus-5.5',
      'opus-5',
      'fable-5.1',
      'fable-5',
      'sonnet-5',
      'sonnet-4.6',
      'haiku-4.5',
      'gpt-6-astra',
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
      'gpt-5.3-codex',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'deepseek-v4.1-flash',
      'deepseek-v4-flash',
      'kimi-k3',
      'kimi-k2.7-code',
      'kimi-k2.6',
      'kimi-k2.5',
      'glm-5.3',
      'glm-5.2',
      'glm-5.1',
      'grok-4.6',
      'grok-4.5',
      'grok-4.3',
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

  it('drops the three vendor ids the openrouter api no longer lists', () => {
    const cliIds = OPENROUTER_CATALOG.map((model) => model.cliId);
    expect(cliIds).not.toContain('openrouter/google/gemini-3.1-pro');
    expect(cliIds).not.toContain('openrouter/deepseek/deepseek-v4');
    expect(cliIds).not.toContain('openrouter/x-ai/grok-4');
    expect(cliIds).toContain('openrouter/google/gemini-3.1-pro-preview');
    expect(cliIds).toContain('openrouter/deepseek/deepseek-v4-pro');
    expect(cliIds).toContain('openrouter/x-ai/grok-4.7');
  });

  it('routes every catalog id through the openrouter provider prefix', () => {
    for (const model of OPENROUTER_CATALOG) {
      expect(model.cliId.startsWith('openrouter/')).toBe(true);
    }
  });
});
