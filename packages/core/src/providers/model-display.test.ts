import { describe, expect, it } from 'vitest';
import { getModelDescriptor, getModelProvider } from './model-display';

describe('provider model display', () => {
  it('resolves OpenCode models', () => {
    expect(getModelProvider('opencode/big-pickle')).toBe('opencode');
    expect(getModelDescriptor('opencode/big-pickle')?.id).toBe('big-pickle');
  });

  it('resolves pre-slugged OpenRouter models', () => {
    expect(getModelProvider('openrouter/anthropic/claude-sonnet-4.5')).toBe('openrouter');
    expect(getModelDescriptor('openrouter/openai/gpt-5.4')?.family).toBe('gpt');
  });

  it('resolves Moonshot models to their own provider, not OpenRouter', () => {
    expect(getModelProvider('moonshotai/kimi-k3')).toBe('moonshot');
    expect(getModelDescriptor('moonshotai/kimi-k3')?.contextWindow).toBe(1_048_576);
  });

  it('resolves variant and combo slugs to authored windows', () => {
    expect(getModelDescriptor('gpt-5.6-sol')?.contextWindow).toBe(1_000_000);
    expect(getModelDescriptor('gpt-5.4-mini')?.contextWindow).toBe(400_000);
    expect(getModelDescriptor('claude-4.6-sonnet-medium')?.contextWindow).toBe(1_000_000);
    expect(getModelDescriptor('composer-2.5-fast')?.contextWindow).toBe(200_000);
  });
});
