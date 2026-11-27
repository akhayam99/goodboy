import { describe, expect, it } from 'vitest';
import { MOONSHOT_MODELS } from './constants';
import { MOONSHOT_CATALOG } from './catalog';
import { MOONSHOT_AGENT_MODEL_IDS } from './agent-model-ids';
import { getCheapModel } from '../cli-defaults';
import { legacyHiddenModels } from '../modelVisibility';
import { strongestModelForTier } from '../strongestModelForTier';

describe('MOONSHOT_MODELS', () => {
  it('contains the kimi ladder moonshot still serves', () => {
    expect(MOONSHOT_MODELS.map((model) => model.id)).toEqual([
      'kimi-k3.1-pro',
      'kimi-k3.1-pro-highspeed',
      'kimi-k3',
      'kimi-k2.7-code-highspeed',
      'kimi-k2.7-code',
      'kimi-k2.6',
    ]);
  });

  it('keeps every catalog cli id spawnable and vendor prefixed', () => {
    for (const model of MOONSHOT_CATALOG) {
      expect(model.cliId.startsWith('moonshotai/')).toBe(true);
      expect(MOONSHOT_AGENT_MODEL_IDS).toContain(model.cliId);
    }
    expect(MOONSHOT_AGENT_MODEL_IDS.length).toBe(MOONSHOT_CATALOG.length);
  });

  it('offers the K3 line Low, High and Max, with Max as its default', () => {
    for (const model of MOONSHOT_CATALOG.filter((candidate) => candidate.legacy !== true)) {
      expect(model.efforts).toEqual(['low', 'high', 'max']);
      expect(model.defaultEffort).toBe('max');
    }
  });

  it('hides every K2 model, which new Moonshot accounts cannot use', () => {
    const legacy = MOONSHOT_CATALOG.filter((model) => model.legacy === true).map(
      (model) => model.presentation.version,
    );

    expect(legacy).toEqual(['K2.7', 'K2.7', 'K2.6']);
  });

  it('runs the cheap jobs on K3.1 Pro while the K2 models are hidden', () => {
    expect(
      strongestModelForTier({
        provider: 'moonshot',
        tier: 'cheap',
        wantsThinker: false,
        hidden: legacyHiddenModels(),
      })?.id,
    ).toBe('kimi-k3.1-pro');
    expect(getCheapModel('moonshot')).toBe('kimi-k3.1-pro');
  });

  it('keeps k3 the widest context and the code models the cheaper ones', () => {
    const byKey = new Map(MOONSHOT_CATALOG.map((model) => [model.key, model]));
    expect(byKey.get('kimi-k3')?.contextWindow).toBe(1_048_576);
    expect(byKey.get('kimi-k2.7-code')?.contextWindow).toBe(262_144);
    expect(byKey.get('kimi-k2.6')?.presentation.costTier).toBe('cheap');
    expect(byKey.get('kimi-k2.7-code-highspeed')?.presentation.costTier).toBe('mid');
  });
});
