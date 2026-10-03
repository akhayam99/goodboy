import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, type CatalogModel } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { defaultTurnModel } from './defaultTurnModel';

describe('defaultTurnModel', () => {
  it('marks exactly one default turn model per provider', () => {
    for (const provider of PROVIDER_IDS) {
      const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
      const marked = catalog.filter((model) => model.defaultTurn === true);
      expect(
        marked.map((model) => model.key),
        provider,
      ).toHaveLength(1);
    }
  });

  it('never marks a legacy model as the default turn model', () => {
    for (const provider of PROVIDER_IDS) {
      expect(defaultTurnModel({ provider }).legacy, provider).toBeUndefined();
    }
  });

  it('keeps the default when the catalog order changes', () => {
    const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS.openrouter;
    expect(catalog[0]?.key).not.toBe(defaultTurnModel({ provider: 'openrouter' }).key);
    expect(defaultTurnModel({ provider: 'anthropic' }).key).toBe('opus-5');
  });
});
