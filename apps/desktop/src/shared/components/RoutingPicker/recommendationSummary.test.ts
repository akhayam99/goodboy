import { describe, expect, it } from 'vitest';
import { recommendationSummary } from './recommendationSummary';

describe('recommendationSummary', () => {
  it('names the recommended provider and its model', () => {
    expect(recommendationSummary({ provider: 'anthropic', model: 'claude-sonnet-4-6' })).toBe(
      'Claude · Sonnet 4.6',
    );
  });

  it('names the provider alone when the model belongs to another provider', () => {
    expect(recommendationSummary({ provider: 'anthropic', model: 'gpt-5.5' })).toBe('Claude');
  });

  it('names the provider alone when no model is recommended', () => {
    expect(recommendationSummary({ provider: 'codex' })).toBe('Codex');
  });
});
