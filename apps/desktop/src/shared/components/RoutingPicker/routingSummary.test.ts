import { describe, expect, it } from 'vitest';
import { MODEL_CATALOGS } from '@goodboy/core';
import type { CatalogModel } from '@goodboy/types';
import { routingSummary, routingTriggerLabel } from './routingSummary';

type FindParams = {
  readonly provider: keyof typeof MODEL_CATALOGS;
  readonly key: string;
};

const catalogModel = ({ provider, key }: FindParams): CatalogModel => {
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
  const model = catalog.find((candidate) => candidate.key === key);
  if (model == null) {
    throw new Error(`missing ${provider} ${key}`);
  }
  return model;
};

describe('routingSummary', () => {
  it('names a model the catalog does not carry by its plain label', () => {
    const label = routingTriggerLabel({
      model: null,
      modelId: 'claude-opus-4-1',
      selection: { key: 'claude-opus-4-1' },
      effort: 'high',
      showEffort: true,
    });
    expect(label.name).toEqual(['Opus 4.1']);
    expect(routingSummary({ provider: 'anthropic', label })).toBe('Claude · Opus 4.1 · High');
  });

  it('drops the version segment when it repeats the family name', () => {
    const label = routingTriggerLabel({
      model: catalogModel({ provider: 'cursor', key: 'auto' }),
      modelId: 'auto',
      selection: { key: 'auto' },
      effort: 'high',
      showEffort: false,
    });
    expect(label.name).toEqual(['Auto']);
  });

  it('drops the family segment when it repeats the provider name', () => {
    const label = routingTriggerLabel({
      model: catalogModel({ provider: 'gemini', key: 'gemini-3.8-flash' }),
      modelId: 'gemini-3.8-flash',
      selection: { key: 'gemini-3.8-flash' },
      effort: 'medium',
      showEffort: true,
    });
    expect(label.name).toEqual(['3.8', 'Flash']);
    expect(routingSummary({ provider: 'gemini', label })).toBe('Gemini · 3.8 · Flash · Medium');
  });

  it('says the mode the model offers and skips the toggle it cannot honor', () => {
    const label = routingTriggerLabel({
      model: catalogModel({ provider: 'cursor', key: 'sonnet-4.6' }),
      modelId: 'claude-4.6-sonnet-medium-thinking',
      selection: { key: 'sonnet-4.6', toggles: { thinking: true, fast: true } },
      effort: 'medium',
      showEffort: true,
      verbosity: 'brief',
    });
    expect(routingSummary({ provider: 'cursor', label })).toBe(
      'Cursor · Sonnet · 4.6 · Thinking · Medium · Brief',
    );
  });
});
