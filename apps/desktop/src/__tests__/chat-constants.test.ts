import { describe, expect, it } from 'vitest';
import { parseModelId } from '../components/chat/chat-constants';

describe('parseModelId', () => {
  it('canonical anthropic ids: family/subfamily/variant', () => {
    expect(parseModelId('claude-haiku-4-5')).toEqual({
      family: 'claude',
      subfamily: 'haiku',
      variantLabel: '4.5',
    });
    expect(parseModelId('claude-sonnet-4-6')).toEqual({
      family: 'claude',
      subfamily: 'sonnet',
      variantLabel: '4.6',
    });
    expect(parseModelId('claude-opus-4-7')).toEqual({
      family: 'claude',
      subfamily: 'opus',
      variantLabel: '4.7',
    });
  });

  it('cursor anthropic naming (version-first)', () => {
    expect(parseModelId('claude-4.6-sonnet-medium')).toEqual({
      family: 'claude',
      subfamily: 'sonnet',
      variantLabel: '4.6 medium',
    });
    expect(parseModelId('claude-4.6-sonnet-high')).toEqual({
      family: 'claude',
      subfamily: 'sonnet',
      variantLabel: '4.6 high',
    });
    expect(parseModelId('claude-4.6-opus-high-thinking')).toEqual({
      family: 'claude',
      subfamily: 'opus',
      variantLabel: '4.6 high thinking',
    });
  });

  it('canonical anthropic with trailing variant suffix', () => {
    expect(parseModelId('claude-opus-4-7-thinking-high')).toEqual({
      family: 'claude',
      subfamily: 'opus',
      variantLabel: '4.7',
    });
  });

  it('composer family', () => {
    expect(parseModelId('composer-2')).toEqual({
      family: 'composer',
      subfamily: null,
      variantLabel: '2',
    });
    expect(parseModelId('composer-2-fast')).toEqual({
      family: 'composer',
      subfamily: null,
      variantLabel: '2-fast',
    });
  });

  it('cursor auto', () => {
    expect(parseModelId('auto')).toEqual({
      family: 'cursor-auto',
      subfamily: null,
      variantLabel: 'auto',
    });
  });

  it('gpt-X.Y with variant', () => {
    expect(parseModelId('gpt-5.5-high')).toEqual({
      family: 'gpt',
      subfamily: '5.5',
      variantLabel: 'high',
    });
    expect(parseModelId('gpt-5.5-medium')).toEqual({
      family: 'gpt',
      subfamily: '5.5',
      variantLabel: 'medium',
    });
  });

  it('gpt-X.Y-codex isolates into its own subfamily', () => {
    expect(parseModelId('gpt-5.3-codex')).toEqual({
      family: 'gpt',
      subfamily: '5.3-codex',
      variantLabel: 'codex',
    });
  });

  it('codex turn-tier models (gpt-5.4-mini, gpt-5.5)', () => {
    expect(parseModelId('gpt-5.4-mini')).toEqual({
      family: 'gpt',
      subfamily: '5.4',
      variantLabel: 'mini',
    });
    expect(parseModelId('gpt-5.5')).toEqual({
      family: 'gpt',
      subfamily: '5.5',
      variantLabel: '5.5',
    });
  });

  it('provider/model prefix — strips the provider prefix before parsing', () => {
    expect(parseModelId('anthropic/claude-sonnet-4-6')).toEqual({
      family: 'claude',
      subfamily: 'sonnet',
      variantLabel: '4.6',
    });
    expect(parseModelId('github-copilot/gpt-5.4')).toEqual({
      family: 'gpt',
      subfamily: '5.4',
      variantLabel: '5.4',
    });
  });

  it('falls back to other for unknown shapes', () => {
    const parsed = parseModelId('something-weird');
    expect(parsed.family).toBe('other');
    expect(parsed.subfamily).toBeNull();
  });
});
