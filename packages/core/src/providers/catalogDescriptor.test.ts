import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { catalogDescriptor } from './catalogDescriptor';

const NON_ANTHROPIC_WEIGHT_CEILING = 30;

describe('catalogDescriptor weights', () => {
  it('ranks Astra one notch above Sol and below Fable 5.1', () => {
    const astra = MODEL_CATALOGS.codex.find((model) => model.key === 'gpt-6');
    const sol = MODEL_CATALOGS.codex.find((model) => model.key === 'gpt-5.6');
    const fable = MODEL_CATALOGS.anthropic.find((model) => model.key === 'fable-5.1');
    if (astra == null || sol == null || fable == null) {
      throw new Error('missing routing weight models');
    }
    expect(catalogDescriptor({ model: astra }).weight).toBe(29);
    expect(catalogDescriptor({ model: sol }).weight).toBe(28);
    expect(catalogDescriptor({ model: fable }).weight).toBe(95);
  });

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
