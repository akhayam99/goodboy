import { describe, expect, it } from 'vitest';
import { parseProviderPricingConfig, getCodexPriceOverride } from './providerPricing';

describe('parseProviderPricingConfig', () => {
  it('returns empty object for null', () => {
    expect(parseProviderPricingConfig(null)).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(parseProviderPricingConfig('')).toEqual({});
  });

  it('returns empty object for invalid JSON', () => {
    expect(parseProviderPricingConfig('not-json')).toEqual({});
  });

  it('returns empty object for JSON non-object', () => {
    expect(parseProviderPricingConfig('"hello"')).toEqual({});
    expect(parseProviderPricingConfig('[1,2]')).toEqual({});
  });

  it('parses a valid config', () => {
    const raw = JSON.stringify({
      codex: {
        'codex-latest': { inputPerMtok: 5, outputPerMtok: 20, cachedInputPerMtok: 0.5 },
      },
    });
    const result = parseProviderPricingConfig(raw);
    expect(result.codex?.['codex-latest']).toEqual({
      inputPerMtok: 5,
      outputPerMtok: 20,
      cachedInputPerMtok: 0.5,
    });
  });

  it('roundtrips through JSON.stringify', () => {
    const config = {
      codex: { 'codex-mini': { inputPerMtok: 2, outputPerMtok: 8 } },
    };
    expect(parseProviderPricingConfig(JSON.stringify(config))).toEqual(config);
  });
});

describe('getCodexPriceOverride', () => {
  it('returns null when no codex config', () => {
    expect(getCodexPriceOverride({}, 'codex-latest')).toBeNull();
  });

  it('returns null when model not in config', () => {
    const config = {
      codex: { 'codex-mini': { inputPerMtok: 2, outputPerMtok: 8 } },
    };
    expect(getCodexPriceOverride(config, 'codex-latest')).toBeNull();
  });

  it('returns null for entry missing required fields', () => {
    const config = {
      codex: {
        'codex-latest': { inputPerMtok: 'bad', outputPerMtok: 20 } as unknown as {
          inputPerMtok: number;
          outputPerMtok: number;
        },
      },
    };
    expect(getCodexPriceOverride(config, 'codex-latest')).toBeNull();
  });

  it('returns override when model found', () => {
    const override = { inputPerMtok: 5, outputPerMtok: 20, cachedInputPerMtok: 0.5 };
    const config = { codex: { 'codex-latest': override } };
    expect(getCodexPriceOverride(config, 'codex-latest')).toEqual(override);
  });
});
