import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, type CatalogModel } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { getCheapModel } from './cli-defaults';
import { CURSOR_AUTO_MODEL } from './cursor/models';

describe('getCheapModel', () => {
  it('picks the newest Haiku, wherever it sits in the catalog', () => {
    const haikus = MODEL_CATALOGS.anthropic.filter((model) => model.presentation.group === 'Haiku');
    expect(haikus.map((model) => model.key)).toContain('haiku-4.5');
    expect(getCheapModel('anthropic')).toBe('haiku-5.5');
  });

  it('takes the cheap entry with the highest catalog order on every provider', () => {
    for (const provider of PROVIDER_IDS) {
      if (provider === 'cursor') {
        continue;
      }
      const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
      const cheap = catalog.filter((model) => model.tier === 'cheap' && model.legacy !== true);
      if (cheap.length === 0) {
        continue;
      }
      const highest = Math.max(...cheap.map((model) => model.presentation.order));
      const picked = catalog.find((model) => model.key === getCheapModel(provider));
      expect(picked?.presentation.order, provider).toBe(highest);
    }
  });

  it('never falls back to a legacy model', () => {
    for (const provider of PROVIDER_IDS) {
      const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
      const picked = catalog.find((model) => model.key === getCheapModel(provider));
      expect(picked?.legacy, provider).toBeUndefined();
    }
  });

  it('keeps Cursor on Auto', () => {
    expect(getCheapModel('cursor')).toBe(CURSOR_AUTO_MODEL);
  });
});
