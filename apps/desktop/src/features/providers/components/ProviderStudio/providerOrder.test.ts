import { describe, expect, it } from 'vitest';
import { PROVIDER_ORDER } from './providerOrder';

describe('PROVIDER_ORDER', () => {
  it('keeps its order', () => {
    expect(PROVIDER_ORDER).toEqual([
      'anthropic',
      'cursor',
      'codex',
      'gemini',
      'opencode',
      'openrouter',
      'moonshot',
    ]);
  });
});
