import { describe, expect, it } from 'vitest';
import { extractQualifiers } from './grammar';
import { PROVIDER_OPTIONS, providerChipOf, providerLabel } from './searchFilterOptions';

describe('search provider filter menu', () => {
  it.each(['openrouter', 'opencode', 'moonshot', 'bitbucket'])(
    'offers %s, which the typed grammar already accepts',
    (provider) => {
      expect(PROVIDER_OPTIONS.map((option) => option.value)).toContain(provider);
      expect(providerChipOf({ value: provider })).toMatchObject({ key: 'provider', provider });
    },
  );

  it('offers every provider the grammar resolves, with the label the typed chip shows', () => {
    for (const alias of ['claude', 'codex', 'openrouter', 'bitbucket', 'sentry']) {
      const parsed = extractQualifiers({
        text: `from:${alias} ledger-core `,
        projects: [],
        now: Date.UTC(2026, 8, 27),
        isFinal: true,
      });
      const chip = parsed.chips.find((candidate) => candidate.key === 'provider');
      expect(chip).toBeDefined();
      if (chip?.key !== 'provider') {
        continue;
      }
      expect(providerChipOf({ value: chip.provider })?.label).toBe(chip.label);
    }
  });

  it('shows OpenRouter, not the raw id, for a hit from that provider', () => {
    expect(providerLabel({ provider: 'openrouter' })).toBe('OpenRouter');
  });

  it('lists each provider once', () => {
    const values = PROVIDER_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
