import { PROVIDER_IDS } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import {
  AUTO_OWN_PROVIDERS,
  AUTO_UNCONFINED_PROVIDERS,
  isAutoChildProvider,
  isAutoOwnProvider,
} from './providers';

describe('auto providers', () => {
  it('lets Auto itself run on every provider that confines a read-only role', () => {
    for (const provider of ['anthropic', 'codex', 'cursor', 'gemini'] as const) {
      expect(AUTO_OWN_PROVIDERS).toContain(provider);
      expect(isAutoOwnProvider({ provider })).toBe(true);
    }
  });

  it('keeps Auto off the opencode family, whose plan agent still asks before a shell command', () => {
    for (const provider of ['opencode', 'openrouter', 'moonshot'] as const) {
      expect(AUTO_OWN_PROVIDERS).not.toContain(provider);
      expect(isAutoOwnProvider({ provider })).toBe(false);
    }
  });

  it('accounts for every provider as either allowed or excluded for Auto', () => {
    for (const provider of PROVIDER_IDS) {
      const isAllowed = AUTO_OWN_PROVIDERS.includes(provider);
      const isExcluded = AUTO_UNCONFINED_PROVIDERS.some((candidate) => candidate === provider);
      expect(isAllowed).toBe(!isExcluded);
    }
  });

  it('keeps the child pool to the providers that confine a role', () => {
    expect(isAutoChildProvider({ provider: 'anthropic' })).toBe(true);
    expect(isAutoChildProvider({ provider: 'codex' })).toBe(true);
    expect(isAutoChildProvider({ provider: 'cursor' })).toBe(false);
    expect(isAutoChildProvider({ provider: 'opencode' })).toBe(false);
  });
});
