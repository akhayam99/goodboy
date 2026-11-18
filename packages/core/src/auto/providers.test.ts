import { PROVIDER_IDS } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import {
  AUTO_OWN_PROVIDERS,
  AUTO_UNCONFINED_PROVIDERS,
  autoChildProviders,
  isAutoChildProvider,
  isAutoOwnProvider,
  isAutoProviderResuming,
} from './providers';
import { AUTO_WRITER_ROLES } from './roles';

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

  it('runs a reading child wherever Auto itself runs read-only', () => {
    for (const role of ['scout', 'planner', 'investigator', 'reviewer'] as const) {
      expect(autoChildProviders({ role })).toEqual(AUTO_OWN_PROVIDERS);
      expect(isAutoChildProvider({ provider: 'cursor', role })).toBe(true);
      expect(isAutoChildProvider({ provider: 'opencode', role })).toBe(false);
    }
  });

  it('keeps a writing child on Claude and Codex, the CLIs that deny a push', () => {
    for (const role of AUTO_WRITER_ROLES) {
      expect(autoChildProviders({ role })).toEqual(['anthropic', 'codex']);
      expect(isAutoChildProvider({ provider: 'cursor', role })).toBe(false);
      expect(isAutoChildProvider({ provider: 'gemini', role })).toBe(false);
    }
  });

  it('names Claude as the only child provider that resumes a session', () => {
    expect(isAutoProviderResuming({ provider: 'anthropic' })).toBe(true);
    expect(isAutoProviderResuming({ provider: 'codex' })).toBe(false);
  });
});
