import { describe, expect, it, vi } from 'vitest';
import {
  getCodexPriceOverride,
  getGeminiPriceOverride,
  getActivePricingTable,
  refreshPricingTable,
} from './provider-pricing';

describe('getActivePricingTable', () => {
  it('returns shipped pricing by default', () => {
    const table = getActivePricingTable();
    expect(table.anthropic).toBeDefined();
    expect(table.codex).toBeDefined();
    expect(table.cursor).toBeDefined();
    expect(table.gemini).toBeDefined();
    expect(typeof table.version).toBe('string');
  });

  it('has claude-sonnet-4-6 anthropic price', () => {
    const price = getActivePricingTable().anthropic['claude-sonnet-4-6'];
    expect(price).toBeDefined();
    expect(price?.inputPerMtok).toBeGreaterThan(0);
    expect(price?.outputPerMtok).toBeGreaterThan(0);
  });
});

describe('getCodexPriceOverride', () => {
  it('returns null for unknown model', () => {
    expect(getCodexPriceOverride(null, 'unknown-model-xyz')).toBeNull();
  });

  it('returns price for known codex model', () => {
    const table = getActivePricingTable();
    const knownModel = Object.keys(table.codex)[0];
    if (knownModel) {
      const result = getCodexPriceOverride(null, knownModel);
      expect(result).not.toBeNull();
      expect(result?.inputPerMtok).toBeGreaterThan(0);
      expect(result?.outputPerMtok).toBeGreaterThan(0);
    }
  });
});

describe('getGeminiPriceOverride', () => {
  it('returns null for unknown model', () => {
    expect(getGeminiPriceOverride(null, 'unknown-model-xyz')).toBeNull();
  });

  it('returns price for known gemini model', () => {
    const table = getActivePricingTable();
    const knownModel = Object.keys(table.gemini)[0];
    if (knownModel) {
      const result = getGeminiPriceOverride(null, knownModel);
      expect(result).not.toBeNull();
      expect(result?.inputPerMtok).toBeGreaterThan(0);
      expect(result?.outputPerMtok).toBeGreaterThan(0);
    }
  });
});

describe('refreshPricingTable', () => {
  // CDN refresh is currently a no-op (placeholder URL `goodboy.dev` was never
  // provisioned). Kept as a stable resolved-undefined contract so callers
  // (e.g. App.tsx boot) don't break.
  it('resolves to undefined without making any network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      await expect(refreshPricingTable()).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
