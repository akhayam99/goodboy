import { PROVIDER_IDS } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { AUTO_OWN_PROVIDERS, isAutoChildProvider } from './providers';

describe('auto providers', () => {
  it('lets Auto itself run on every provider, as it only reads', () => {
    for (const provider of PROVIDER_IDS) {
      expect(AUTO_OWN_PROVIDERS).toContain(provider);
    }
  });

  it('keeps the child pool to the providers that confine a role', () => {
    expect(isAutoChildProvider({ provider: 'anthropic' })).toBe(true);
    expect(isAutoChildProvider({ provider: 'codex' })).toBe(true);
    expect(isAutoChildProvider({ provider: 'cursor' })).toBe(false);
  });
});
