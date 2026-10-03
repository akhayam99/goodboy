import { describe, expect, it } from 'vitest';
import { MODEL_CATALOGS } from './catalogs';
import { PROVIDER_IDS } from '@goodboy/types';
import { catalogDescriptor, WEIGHT_BY_KEY } from './catalogDescriptor';

describe('catalogDescriptor weights', () => {
  it('ranks Astra one notch above Sol and below Fable 5.1', () => {
    const astra = MODEL_CATALOGS.codex.find((model) => model.key === 'gpt-6');
    const sol = MODEL_CATALOGS.codex.find((model) => model.key === 'gpt-5.6-sol');
    const fable = MODEL_CATALOGS.anthropic.find((model) => model.key === 'fable-5.1');
    if (astra == null || sol == null || fable == null) {
      throw new Error('missing routing weight models');
    }
    expect(catalogDescriptor({ model: astra }).weight).toBe(29);
    expect(catalogDescriptor({ model: sol }).weight).toBe(28);
    expect(catalogDescriptor({ model: fable }).weight).toBe(95);
  });

  it('ranks GPT-6.1 Sol level with the Sol it follows and below Astra', () => {
    const next = MODEL_CATALOGS.codex.find((model) => model.key === 'gpt-6.1-sol');
    if (next == null) {
      throw new Error('missing codex GPT-6.1 Sol');
    }
    expect(catalogDescriptor({ model: next }).weight).toBe(28);
  });

  it('ranks kimi-k3 above the older kimi-k2 and below sonnet-4.5', () => {
    const kimi = MODEL_CATALOGS.moonshot.find((model) => model.key === 'kimi-k3');
    const sonnet = MODEL_CATALOGS.anthropic.find((model) => model.key === 'sonnet-4.5');
    const older = MODEL_CATALOGS.openrouter.find((model) => model.key === 'kimi-k2');
    expect(catalogDescriptor({ model: kimi! }).weight).toBe(12);
    expect(catalogDescriptor({ model: older! }).weight).toBe(8);
    expect(catalogDescriptor({ model: sonnet! }).weight).toBe(14);
  });

  it('gives every catalog model a weight row of its own', () => {
    const missing = PROVIDER_IDS.flatMap((provider) =>
      MODEL_CATALOGS[provider]
        .filter((model) => !(model.key in WEIGHT_BY_KEY))
        .map((model) => `${provider}:${model.key}`),
    );
    expect(missing).toEqual([]);
  });

  it('weighs the openrouter Astra like the codex one', () => {
    const astra = MODEL_CATALOGS.openrouter.find((model) => model.key === 'gpt-6-astra');
    expect(catalogDescriptor({ model: astra! }).weight).toBe(29);
  });
});
