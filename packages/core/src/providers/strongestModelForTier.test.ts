import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';
import { strongestModelForTier } from './strongestModelForTier';

describe('strongestModelForTier', () => {
  it('gives an implementer the strongest expensive model that is not thinker only', () => {
    expect(
      strongestModelForTier({ provider: 'anthropic', tier: 'expensive', wantsThinker: false })?.id,
    ).toBe('opus-5');
  });

  it('gives a thinker the top of the same tier', () => {
    expect(
      strongestModelForTier({ provider: 'anthropic', tier: 'expensive', wantsThinker: true })?.id,
    ).toBe('fable-5.1');
  });

  it('answers with the top of the requested tier, not the top of the catalogue', () => {
    expect(
      strongestModelForTier({ provider: 'anthropic', tier: 'mid', wantsThinker: false })?.id,
    ).toBe('sonnet-5');
    expect(
      strongestModelForTier({ provider: 'anthropic', tier: 'cheap', wantsThinker: false })?.id,
    ).toBe('haiku-4.5');
  });

  it('falls to the nearest tier when the provider has none of the requested one', () => {
    expect(
      strongestModelForTier({ provider: 'gemini', tier: 'expensive', wantsThinker: false })?.id,
    ).toBe('gemini-3.1-pro');
  });

  it('never answers with a thinker-only model for an implementer', () => {
    for (const provider of PROVIDER_IDS) {
      const model = strongestModelForTier({ provider, tier: 'expensive', wantsThinker: false });
      expect(model?.thinkerOnly ?? false).toBe(false);
    }
  });
});
