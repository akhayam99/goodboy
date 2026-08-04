import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS, modelAxes } from '@goodboy/core';
import { resolveRouting } from './resolveRouting';

const routingFor = ({ provider, model }: { provider: ProviderId; model: string }) =>
  resolveRouting({ providers: [provider], provider, model, effort: 'medium' });

describe('resolveRouting parity across providers', () => {
  it('resolves every catalog model of every provider', () => {
    for (const provider of PROVIDER_IDS) {
      const catalog = MODEL_CATALOGS[provider];
      expect(catalog.length, `${provider} has an empty catalog`).toBeGreaterThan(0);
      for (const model of catalog) {
        const routing = routingFor({ provider, model: model.key });
        expect(routing.provider).toBe(provider);
        expect(routing.model).toBe(model.key);
      }
    }
  });

  it('calls the effort fixed only when the picker offers no choice', () => {
    const disagreements: string[] = [];
    for (const provider of PROVIDER_IDS) {
      for (const model of MODEL_CATALOGS[provider]) {
        const routing = routingFor({ provider, model: model.key });
        const axis = modelAxes({ model, selection: routing.selection }).effort;
        const editable = (axis?.levels ?? []).filter((level) => level.available).length > 1;
        if (editable === routing.isEffortFixed) {
          disagreements.push(
            `${provider}/${model.key}: axis offers ${axis?.levels.filter((l) => l.available).length ?? 0} levels, isEffortFixed=${routing.isEffortFixed}`,
          );
        }
      }
    }
    expect(
      disagreements,
      `The trigger label and the effort chips must agree on whether effort is editable:\n${disagreements.join('\n')}`,
    ).toEqual([]);
  });

  it('offers gemini the effort levels its catalog declares', () => {
    const gemini = MODEL_CATALOGS.gemini.find((model) => model.efforts.length > 1);
    expect(gemini, 'gemini should ship at least one model with a choice of efforts').toBeDefined();
    if (gemini == null) {
      return;
    }
    const routing = routingFor({ provider: 'gemini', model: gemini.key });
    expect(routing.effortLevels).toEqual(gemini.efforts);
    expect(routing.isEffortFixed).toBe(false);
  });
});
