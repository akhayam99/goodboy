import { describe, expect, it } from 'vitest';
import { getModelDescriptor, getModelProvider } from './model-display';

describe('provider model display', () => {
  it('resolves Astra presentation from its cli id', () => {
    expect(getModelProvider('gpt-6-astra')).toBe('codex');
    expect(getModelDescriptor({ id: 'gpt-6-astra' })).toMatchObject({
      id: 'gpt-6',
      label: 'Astra',
      family: 'gpt',
      variantLabel: '6 Astra',
      contextWindow: 1_000_000,
      costTier: 'expensive',
    });
  });

  it('resolves GPT-6.1 Sol presentation from its cli id', () => {
    expect(getModelProvider('gpt-6.1-sol')).toBe('codex');
    expect(getModelDescriptor({ id: 'gpt-6.1-sol' })).toMatchObject({
      id: 'gpt-6.1-sol',
      label: 'GPT-6.1 Sol',
      family: 'gpt',
      variantLabel: '6.1 Sol',
      contextWindow: 1_000_000,
      costTier: 'expensive',
    });
  });

  it('resolves OpenCode models', () => {
    expect(getModelProvider('opencode/big-pickle')).toBe('opencode');
    expect(getModelDescriptor({ id: 'opencode/big-pickle' })?.id).toBe('big-pickle');
  });

  it('resolves pre-slugged OpenRouter models', () => {
    expect(getModelProvider('openrouter/anthropic/claude-sonnet-4.5')).toBe('openrouter');
    expect(getModelDescriptor({ id: 'openrouter/openai/gpt-5.4' })?.family).toBe('gpt');
  });

  it('resolves Moonshot models to their own provider, not OpenRouter', () => {
    expect(getModelProvider('moonshotai/kimi-k3')).toBe('moonshot');
    expect(getModelDescriptor({ id: 'moonshotai/kimi-k3' })?.contextWindow).toBe(1_048_576);
  });

  it('resolves variant and combo slugs to authored windows', () => {
    expect(getModelDescriptor({ id: 'gpt-5.6-sol' })?.contextWindow).toBe(1_000_000);
    expect(getModelDescriptor({ id: 'gpt-6-astra' })?.contextWindow).toBe(1_000_000);
    expect(getModelDescriptor({ id: 'claude-4.6-sonnet-medium' })?.contextWindow).toBe(1_000_000);
    expect(getModelDescriptor({ id: 'composer-2.5-fast' })?.contextWindow).toBe(200_000);
  });

  it('resolves a key shared by codex and cursor to codex', () => {
    expect(getModelProvider('gpt-5.5')).toBe('codex');
  });

  it('leaves the bare gpt-5.6 key to cursor, the only catalog that still owns it', () => {
    expect(getModelProvider('gpt-5.6')).toBe('cursor');
    expect(getModelProvider('gpt-5.6-sol')).toBe('codex');
    expect(getModelProvider('gpt-5.6-luna')).toBe('codex');
  });

  it('keeps keys shared with cursor attributed to the provider that owns them', () => {
    expect(getModelProvider('kimi-k3')).toBe('moonshot');
    expect(getModelProvider('muse-spark-1.3')).toBe('opencode');
    expect(getModelProvider('grok-4.6')).toBe('cursor');
    expect(getModelProvider('grok-4.7')).toBe('cursor');
    expect(getModelProvider('opus-5')).toBe('anthropic');
  });

  it('leaves an aggregated key with the direct provider and keeps the openrouter-only ones', () => {
    expect(getModelProvider('fable-5.1')).toBe('anthropic');
    expect(getModelProvider('gpt-5.6-sol')).toBe('codex');
    expect(getModelProvider('gemini-3.7-flash')).toBe('gemini');
    expect(getModelProvider('glm-5.3')).toBe('openrouter');
    expect(getModelProvider('deepseek-v4-pro')).toBe('openrouter');
  });

  it('leaves gemini-3.1-pro with Gemini, which owns the id, not Cursor', () => {
    expect(getModelProvider('gemini-3.1-pro')).toBe('gemini');
    expect(getModelDescriptor({ id: 'gemini-3.1-pro' })).toBe(
      getModelDescriptor({ id: 'gemini-3.1-pro', provider: 'gemini' }),
    );
  });

  it('gives each provider its own descriptor for an id the catalogs share', () => {
    const gemini = getModelDescriptor({ id: 'gemini-3.1-pro', provider: 'gemini' });
    const cursor = getModelDescriptor({ id: 'gemini-3.1-pro', provider: 'cursor' });

    expect(gemini).not.toBeNull();
    expect(cursor).not.toBeNull();
    expect(cursor).not.toBe(gemini);
  });

  it('falls back to the first provider when the pinned one does not know the id', () => {
    expect(getModelDescriptor({ id: 'gpt-6-astra', provider: 'gemini' })).toBe(
      getModelDescriptor({ id: 'gpt-6-astra' }),
    );
  });

  it('never lets a catalog key beat the real cursor slug of another provider', () => {
    expect(getModelProvider('kimi-k2.7-code')).toBe('cursor');
    expect(getModelDescriptor({ id: 'kimi-k2.7-code' })).toBe(
      getModelDescriptor({ id: 'kimi-k2.7-code', provider: 'cursor' }),
    );
  });
});
