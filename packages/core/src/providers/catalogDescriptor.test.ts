import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { catalogDescriptor } from './catalogDescriptor';

const NON_ANTHROPIC_WEIGHT_CEILING = 30;

describe('catalogDescriptor weights', () => {
  it('keeps every non-anthropic model below the implementer band', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of MODEL_CATALOGS[provider]) {
        if (model.presentation.family === 'claude') {
          continue;
        }
        expect(catalogDescriptor({ model }).weight).toBeLessThan(NON_ANTHROPIC_WEIGHT_CEILING);
      }
    }
  });

  it('ranks kimi-k3 above the unlisted-model fallback and below sonnet-4.5', () => {
    const kimi = MODEL_CATALOGS.moonshot.find((model) => model.key === 'kimi-k3');
    const sonnet = MODEL_CATALOGS.anthropic.find((model) => model.key === 'sonnet-4.5');
    const unlisted = MODEL_CATALOGS.openrouter.find((model) => model.key === 'kimi-k2');
    expect(catalogDescriptor({ model: kimi! }).weight).toBe(12);
    expect(catalogDescriptor({ model: unlisted! }).weight).toBe(10);
    expect(catalogDescriptor({ model: sonnet! }).weight).toBe(14);
  });
});
