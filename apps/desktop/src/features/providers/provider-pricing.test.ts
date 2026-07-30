import { afterEach, describe, expect, it } from 'vitest';
import {
  getCodexPriceOverride,
  getGeminiPriceOverride,
  getActivePricingTable,
} from './provider-pricing';

type PricingWindow = Window & {
  __DEV_PRICING_OVERRIDE__?: Partial<ReturnType<typeof getActivePricingTable>>;
};

const pricingWindow = window as PricingWindow;

afterEach(() => {
  delete pricingWindow.__DEV_PRICING_OVERRIDE__;
});

describe('getActivePricingTable', () => {
  it('returns shipped pricing by default', () => {
    const table = getActivePricingTable();
    expect(table.anthropic).toBeDefined();
    expect(table.codex).toBeDefined();
    expect(table.gemini).toBeDefined();
    expect(typeof table.version).toBe('string');
  });

  it('pins the reconciled opus price', () => {
    expect(getActivePricingTable().anthropic['claude-opus-4-7']).toEqual({
      inputPerMtok: 5,
      outputPerMtok: 25,
      cachedInputPerMtok: 0.5,
    });
  });
});

describe('getCodexPriceOverride', () => {
  it('returns null for unknown model', () => {
    expect(getCodexPriceOverride(null, 'unknown-model-xyz')).toBeNull();
  });

  it('returns price for known codex model', () => {
    expect(getCodexPriceOverride(null, 'gpt-5.6-sol')).toEqual({
      inputPerMtok: 5,
      outputPerMtok: 30,
      cachedInputPerMtok: 0.5,
    });
  });

  it('keeps the development override hook active', () => {
    pricingWindow.__DEV_PRICING_OVERRIDE__ = {
      codex: {
        'gpt-5.6-sol': {
          inputPerMtok: 7,
          outputPerMtok: 42,
          cachedInputPerMtok: 0.7,
        },
      },
    };

    expect(getCodexPriceOverride(null, 'gpt-5.6-sol')).toEqual({
      inputPerMtok: 7,
      outputPerMtok: 42,
      cachedInputPerMtok: 0.7,
    });
  });
});

describe('getGeminiPriceOverride', () => {
  it('returns null for unknown model', () => {
    expect(getGeminiPriceOverride(null, 'unknown-model-xyz')).toBeNull();
  });

  it('returns price for known gemini model', () => {
    expect(getGeminiPriceOverride(null, 'gemini-3.1-pro')).toEqual({
      inputPerMtok: 2,
      outputPerMtok: 12,
      cachedInputPerMtok: 0.2,
    });
  });
});
