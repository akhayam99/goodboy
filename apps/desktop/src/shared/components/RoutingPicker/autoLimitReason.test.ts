import { describe, expect, it } from 'vitest';
import { AUTO_RECOMMENDATION_COPY } from './autoRecommendationCopy';
import { autoLimitReason } from './autoLimitReason';

describe('autoLimitReason', () => {
  it('says why Auto left the default provider', () => {
    expect(
      autoLimitReason({
        defaultProvider: 'codex',
        pickedProvider: 'anthropic',
        atLimit: ['codex'],
      }),
    ).toBe('Codex is at its usage limit, so Auto picks Claude until it resets.');
  });

  it('keeps the usual reason when Auto stays on the default provider', () => {
    expect(
      autoLimitReason({
        defaultProvider: 'anthropic',
        pickedProvider: 'anthropic',
        atLimit: ['codex'],
      }),
    ).toBe(AUTO_RECOMMENDATION_COPY.reason);
    expect(
      autoLimitReason({ defaultProvider: 'codex', pickedProvider: 'anthropic', atLimit: [] }),
    ).toBe(AUTO_RECOMMENDATION_COPY.reason);
  });
});
