import { describe, expect, it } from 'vitest';
import { getModelDescriptor, getModelProvider } from './model-display';

describe('provider model display', () => {
  it('resolves OpenCode models', () => {
    expect(getModelProvider('opencode/big-pickle')).toBe('opencode');
    expect(getModelDescriptor('opencode/big-pickle')?.id).toBe('opencode/big-pickle');
  });

  it('resolves pre-slugged OpenRouter models', () => {
    expect(getModelProvider('openrouter/anthropic/claude-sonnet-4.5')).toBe('openrouter');
    expect(getModelDescriptor('openrouter/openai/gpt-5.4')?.family).toBe('gpt');
  });
});
