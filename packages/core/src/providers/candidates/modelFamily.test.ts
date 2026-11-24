import { describe, expect, it } from 'vitest';
import { modelFamily } from './modelFamily';

describe('modelFamily', () => {
  it('reads the family from the catalog group, whatever provider serves it', () => {
    expect(modelFamily({ provider: 'anthropic', model: 'sonnet-5.5' })).toBe('claude');
    expect(modelFamily({ provider: 'cursor', model: 'sonnet-5.5' })).toBe('claude');
    expect(modelFamily({ provider: 'codex', model: 'gpt-6.1-sol' })).toBe('gpt');
    expect(modelFamily({ provider: 'gemini', model: 'gemini-3.1-pro' })).toBe('gemini');
  });

  it('knows no family for Cursor Auto or an unknown model', () => {
    expect(modelFamily({ provider: 'cursor', model: 'auto' })).toBeNull();
    expect(modelFamily({ provider: 'anthropic', model: 'sonnet-0.1' })).toBeNull();
  });
});
