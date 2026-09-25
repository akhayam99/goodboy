import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { effectiveProviderPool, toggledProviderPool } from './providerPool';

const PROVIDERS: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'gemini'];

describe('toggledProviderPool', () => {
  it('narrows every provider to the ones left checked', () => {
    expect(toggledProviderPool({ providers: PROVIDERS, pool: null, provider: 'gemini' })).toEqual([
      'anthropic',
      'codex',
    ]);
  });

  it('adds a provider back in the connected order', () => {
    expect(
      toggledProviderPool({ providers: PROVIDERS, pool: ['gemini'], provider: 'anthropic' }),
    ).toEqual(['anthropic', 'gemini']);
  });

  it('goes back to every provider once all of them are checked', () => {
    expect(
      toggledProviderPool({
        providers: PROVIDERS,
        pool: ['anthropic', 'codex'],
        provider: 'gemini',
      }),
    ).toBeNull();
  });

  it('keeps the last provider checked', () => {
    expect(
      toggledProviderPool({ providers: PROVIDERS, pool: ['codex'], provider: 'codex' }),
    ).toEqual(['codex']);
  });
});

describe('effectiveProviderPool', () => {
  it('drops a provider that disconnected since it was picked', () => {
    expect(
      effectiveProviderPool({ providers: ['anthropic', 'codex'], pool: ['codex', 'gemini'] }),
    ).toEqual(['codex']);
  });

  it('means every provider when nothing picked is still connected', () => {
    expect(effectiveProviderPool({ providers: ['anthropic'], pool: ['gemini'] })).toBeNull();
  });

  it('means every provider when every connected one is picked', () => {
    expect(
      effectiveProviderPool({ providers: ['anthropic'], pool: ['anthropic', 'gemini'] }),
    ).toBeNull();
  });
});
