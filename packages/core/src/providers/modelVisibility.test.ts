import { describe, expect, it } from 'vitest';
import { MODEL_CATALOGS } from './catalogs';
import { modelAxes } from './modelAxes';
import {
  legacyHiddenModels,
  parseHiddenModels,
  visibleCatalog,
  withModelsVisible,
} from './modelVisibility';

describe('model visibility', () => {
  it('hides the legacy versions until the user chooses', () => {
    const hidden = legacyHiddenModels();
    expect(hidden.anthropic).toEqual(['opus-4.7', 'opus-4.6', 'sonnet-4.5']);
    expect(hidden.codex).toEqual(['gpt-5.5']);
    expect(hidden.gemini).toEqual(['gemini-3.6-flash']);
    expect(parseHiddenModels(null)).toEqual(hidden);
  });

  it('keeps a stored choice even when it shows every legacy model', () => {
    expect(parseHiddenModels('{"anthropic":[]}')).toEqual({ anthropic: [] });
    expect(parseHiddenModels('not json')).toEqual(legacyHiddenModels());
  });

  it('always shows the current value even when it is hidden', () => {
    const hidden = { anthropic: ['opus-4.6'] };
    const keys = visibleCatalog({ provider: 'anthropic', hidden, currentKey: 'opus-4.6' }).map(
      (model) => model.key,
    );
    expect(keys).toContain('opus-4.6');
    expect(
      visibleCatalog({ provider: 'anthropic', hidden }).map((model) => model.key),
    ).not.toContain('opus-4.6');
  });

  it('never hides the last visible model of a provider', () => {
    const every = MODEL_CATALOGS.gemini.map((model) => model.key);
    const hidden = withModelsVisible({
      provider: 'gemini',
      hidden: {},
      keys: every,
      visible: false,
    });
    expect(hidden).toEqual({});
    const allButOne = every.slice(1);
    expect(
      withModelsVisible({ provider: 'gemini', hidden: {}, keys: allButOne, visible: false }).gemini,
    ).toEqual(allButOne);
  });

  it('drops a family from the Model row once all its versions are hidden', () => {
    const model = MODEL_CATALOGS.anthropic.find((candidate) => candidate.key === 'sonnet-5');
    if (model == null) {
      throw new Error('sonnet-5 missing');
    }
    const opusKeys = MODEL_CATALOGS.anthropic
      .filter((candidate) => candidate.presentation.group === 'Opus')
      .map((candidate) => candidate.key);
    const catalog = visibleCatalog({ provider: 'anthropic', hidden: { anthropic: opusKeys } });
    const axes = modelAxes({ model, selection: { key: 'sonnet-5' }, catalog });
    expect(axes.model?.options.map((option) => option.label)).not.toContain('Opus');
    expect(axes.model?.options.map((option) => option.label)).toContain('Sonnet');
  });
});
