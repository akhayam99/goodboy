import { describe, expect, it } from 'vitest';
import { PROVIDER_ORDER } from './ProvidersStep';

describe('PROVIDER_ORDER', () => {
  it('swaps codex and cursor relative to the canonical registry order', () => {
    expect(PROVIDER_ORDER).toEqual([
      'anthropic',
      'codex',
      'cursor',
      'gemini',
      'opencode',
      'openrouter',
      'moonshot',
    ]);
  });
});
