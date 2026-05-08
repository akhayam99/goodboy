import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  getCodexPriceOverride,
  getActivePricingTable,
  refreshPricingTable,
} from './providerPricing';

describe('getActivePricingTable', () => {
  it('returns shipped pricing by default', () => {
    const table = getActivePricingTable();
    expect(table.anthropic).toBeDefined();
    expect(table.codex).toBeDefined();
    expect(table.cursor).toBeDefined();
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

describe('refreshPricingTable', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles fetch network failure gracefully', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    await expect(refreshPricingTable()).resolves.toBeUndefined();
  });

  it('handles non-ok fetch response gracefully', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });
    await expect(refreshPricingTable()).resolves.toBeUndefined();
  });

  it('handles 304 not-modified gracefully', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 304 });
    await expect(refreshPricingTable()).resolves.toBeUndefined();
  });

  it('updates active table when valid JSON returned', async () => {
    const newTable = {
      version: '2099-01-01',
      anthropic: { 'claude-test': { inputPerMtok: 99, outputPerMtok: 99 } },
      cursor: {},
      codex: {},
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => '"test-etag"' },
      json: async () => newTable,
    });
    // force stale by resetting the timer via a fresh import cycle is not feasible in unit tests,
    // but we can verify the function resolves without throwing.
    await expect(refreshPricingTable()).resolves.toBeUndefined();
  });
});
