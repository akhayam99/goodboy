import { describe, expect, it } from 'vitest';
import type { ModelSelection } from '@goodboy/types';
import { PROVIDER_IDS } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { ANTHROPIC_CATALOG } from './claude/catalog';
import { CODEX_CATALOG } from './codex/catalog';
import { CURSOR_CATALOG } from './cursor/catalog';
import { modelAxes } from './modelAxes';
import { OPENCODE_CATALOG } from './opencode/catalog';
import { OPENROUTER_CATALOG } from './openrouter/catalog';
import { selectionRequiresMaxMode } from './selectionRequiresMaxMode';

describe('modelAxes', () => {
  it('offers Astra as the newest GPT version with the full Codex effort ladder', () => {
    const model = CODEX_CATALOG.find((candidate) => candidate.key === 'gpt-6');
    if (model == null) {
      throw new Error('missing codex Astra');
    }
    const axes = modelAxes({ model, selection: { key: model.key, variant: 'astra' } });
    expect(axes.model.options).toContainEqual({ id: 'GPT', label: 'GPT', modelKey: 'gpt-6' });
    expect(axes.version?.options).toContainEqual({ id: '6', label: '6', modelKey: 'gpt-6' });
    expect(axes.checkpoint).toEqual({
      label: 'Variant',
      options: [{ id: 'Astra', label: 'Astra', modelKey: 'gpt-6' }],
      activeId: 'Astra',
    });
    expect(axes.effort?.levels).toEqual([
      { level: 'low', available: true },
      { level: 'medium', available: true },
      { level: 'high', available: true },
      { level: 'xhigh', available: true },
      { level: 'max', available: true },
    ]);
    expect(axes.variant).toBeNull();
  });

  it('changes cursor effort availability with the thinking toggle', () => {
    const model = CURSOR_CATALOG.find((candidate) => candidate.key === 'opus-5');
    if (model == null) {
      throw new Error('missing cursor opus-5');
    }
    const standard = modelAxes({
      model,
      selection: { key: model.key, toggles: { thinking: false, fast: false } },
    });
    const thinking = modelAxes({
      model,
      selection: { key: model.key, toggles: { thinking: true, fast: false } },
    });
    expect(
      standard.effort?.levels.filter((level) => level.available).map((level) => level.level),
    ).toEqual(['low']);
    expect(
      thinking.effort?.levels.filter((level) => level.available).map((level) => level.level),
    ).toEqual(['high']);
  });

  it('exposes each available Cursor toggle once with its active state', () => {
    const composer = CURSOR_CATALOG.find((candidate) => candidate.key === 'composer-2.5');
    const opus = CURSOR_CATALOG.find((candidate) => candidate.key === 'opus-5');
    if (composer == null || opus == null) {
      throw new Error('missing cursor toggle fixtures');
    }
    expect(
      modelAxes({
        model: composer,
        selection: { key: composer.key, toggles: { fast: true } },
      }).toggles,
    ).toEqual([{ id: 'fast', label: 'Fast', active: true, canToggle: true }]);
    expect(
      modelAxes({
        model: opus,
        selection: { key: opus.key, toggles: { thinking: false } },
      }).toggles,
    ).toEqual([{ id: 'thinking', label: 'Thinking', active: false, canToggle: true }]);
  });

  it('offers the gpt-5.6 checkpoints as a Variant row, one key each', () => {
    const model = CODEX_CATALOG.find((candidate) => candidate.key === 'gpt-5.6-terra');
    if (model == null) {
      throw new Error('missing codex gpt-5.6-terra');
    }
    const axes = modelAxes({ model, selection: { key: model.key } });
    expect(axes.checkpoint?.label).toBe('Variant');
    expect(axes.checkpoint?.options).toEqual([
      { id: 'Luna', label: 'Luna', modelKey: 'gpt-5.6-luna' },
      { id: 'Terra', label: 'Terra', modelKey: 'gpt-5.6-terra' },
      { id: 'Sol', label: 'Sol', modelKey: 'gpt-5.6-sol' },
    ]);
    expect(axes.checkpoint?.activeId).toBe('Terra');
  });

  it('keeps the cli variant row empty, because one key is one spawnable model', () => {
    for (const model of CODEX_CATALOG) {
      expect(modelAxes({ model, selection: { key: model.key } }).variant).toBeNull();
    }
  });

  it('carries the chosen checkpoint to a version that still ships it', () => {
    const terra = CODEX_CATALOG.find((candidate) => candidate.key === 'gpt-5.6-terra');
    const luna = CODEX_CATALOG.find((candidate) => candidate.key === 'gpt-5.6-luna');
    if (terra == null || luna == null) {
      throw new Error('missing codex gpt-5.6 checkpoints');
    }
    const fromTerra = modelAxes({ model: terra, selection: { key: terra.key } });
    const fromLuna = modelAxes({ model: luna, selection: { key: luna.key } });
    expect(fromTerra.version?.options.find((option) => option.id === '5.6')?.modelKey).toBe(
      'gpt-5.6-terra',
    );
    expect(fromLuna.version?.options.find((option) => option.id === '5.6')?.modelKey).toBe(
      'gpt-5.6-luna',
    );
    expect(fromTerra.version?.options.find((option) => option.id === '6')?.modelKey).toBe('gpt-6');
  });

  it('gives each gpt checkpoint its own version chip, so cost is selectable', () => {
    const model = CODEX_CATALOG.find((candidate) => candidate.key === 'gpt-5.6-luna');
    if (model == null) {
      throw new Error('missing codex gpt-5.6-luna');
    }
    const axes = modelAxes({ model, selection: { key: model.key } });
    expect(axes.version?.options).toEqual([
      { id: '5.5', label: '5.5', modelKey: 'gpt-5.5' },
      { id: '5.6', label: '5.6', modelKey: 'gpt-5.6-luna' },
      { id: '6', label: '6', modelKey: 'gpt-6' },
    ]);
    expect(axes.version?.activeId).toBe('5.6');
  });

  it('marks unsupported anthropic effort levels as unavailable instead of hiding them', () => {
    const model = ANTHROPIC_CATALOG.find((candidate) => candidate.key === 'sonnet-4.6');
    if (model == null) {
      throw new Error('missing anthropic sonnet-4.6');
    }
    expect(modelAxes({ model, selection: { key: model.key } }).effort?.levels).toEqual([
      { level: 'low', available: true },
      { level: 'medium', available: true },
      { level: 'high', available: true },
      { level: 'xhigh', available: false },
      { level: 'max', available: false },
    ]);
  });

  it('omits effort and variant axes the model does not support', () => {
    const model = ANTHROPIC_CATALOG.find((candidate) => candidate.key === 'haiku-4.5');
    if (model == null) {
      throw new Error('missing anthropic haiku-4.5');
    }
    const axes = modelAxes({ model, selection: { key: model.key } });
    expect(axes.effort).toBeNull();
    expect(axes.variant).toBeNull();
  });

  it('represents each model group by its newest version', () => {
    const model = ANTHROPIC_CATALOG.find((candidate) => candidate.key === 'sonnet-4.6');
    if (model == null) {
      throw new Error('missing anthropic sonnet-4.6');
    }
    const options = modelAxes({ model, selection: { key: model.key } }).model.options;
    const newestByGroup = new Map<string, string>();
    for (const candidate of ANTHROPIC_CATALOG) {
      const group = candidate.presentation.group;
      const current = ANTHROPIC_CATALOG.find((entry) => entry.key === newestByGroup.get(group));
      if (current == null || candidate.presentation.order > current.presentation.order) {
        newestByGroup.set(group, candidate.key);
      }
    }
    expect(options.length).toBe(newestByGroup.size);
    for (const option of options) {
      expect(option.modelKey).toBe(newestByGroup.get(option.id));
    }
    expect(options.find((option) => option.id === 'Opus')?.modelKey).not.toBe('opus-4.6');
  });

  it('omits the version axis for a family that ships a single model', () => {
    const model = CURSOR_CATALOG.find((candidate) => candidate.key === 'auto');
    if (model == null) {
      throw new Error('missing cursor auto');
    }
    const axes = modelAxes({ model, selection: { key: model.key } });
    expect(axes.model.activeId).toBe('Auto');
    expect(axes.version).toBeNull();
  });

  it('uses Effort as the effort axis label across providers', () => {
    const models = [
      ANTHROPIC_CATALOG.find((candidate) => candidate.key === 'opus-5'),
      CODEX_CATALOG[0],
      CURSOR_CATALOG.find((candidate) => candidate.key === 'opus-5'),
      OPENCODE_CATALOG[0],
      OPENROUTER_CATALOG[0],
    ];
    for (const model of models) {
      if (model == null) {
        throw new Error('missing effort axis fixture');
      }
      expect(modelAxes({ model, selection: { key: model.key } }).effort?.label).toBe('Effort');
    }
  });

  it('gives cursor one chip per family, each led by its newest version', () => {
    const model = CURSOR_CATALOG.find((candidate) => candidate.key === 'sonnet-5');
    if (model == null) {
      throw new Error('missing cursor sonnet-5');
    }
    const options = modelAxes({ model, selection: { key: model.key } }).model.options;
    expect(options).toEqual([
      { id: 'Auto', label: 'Auto', modelKey: 'auto' },
      { id: 'Composer', label: 'Composer', modelKey: 'composer-2.5' },
      { id: 'Sonnet', label: 'Sonnet', modelKey: 'sonnet-5' },
      { id: 'Opus', label: 'Opus', modelKey: 'opus-5.5' },
      { id: 'Fable', label: 'Fable', modelKey: 'fable-5.1' },
      { id: 'GPT', label: 'GPT', modelKey: 'gpt-5.6' },
      { id: 'Grok', label: 'Grok', modelKey: 'grok-4.7' },
      { id: 'Gemini', label: 'Gemini', modelKey: 'gemini-3.1-pro' },
      { id: 'Muse Spark', label: 'Muse Spark', modelKey: 'muse-spark-1.3' },
      { id: 'Kimi', label: 'Kimi', modelKey: 'kimi-k3' },
      { id: 'GLM', label: 'GLM', modelKey: 'glm-5.2' },
    ]);
  });

  it('splits a cursor family into numeric version chips and a variant row', () => {
    const model = CURSOR_CATALOG.find((candidate) => candidate.key === 'gemini-3.6-flash');
    if (model == null) {
      throw new Error('missing cursor gemini-3.6-flash');
    }
    const axes = modelAxes({ model, selection: { key: model.key } });
    expect(axes.model.activeId).toBe('Gemini');
    expect(axes.version?.label).toBe('Version');
    expect(axes.version?.options).toEqual([
      { id: '3', label: '3', modelKey: 'gemini-3-flash' },
      { id: '3.1', label: '3.1', modelKey: 'gemini-3.1-pro' },
      { id: '3.5', label: '3.5', modelKey: 'gemini-3.5-flash' },
      { id: '3.6', label: '3.6', modelKey: 'gemini-3.6-flash' },
      { id: '3.7', label: '3.7', modelKey: 'gemini-3.7-flash' },
      { id: '3.8', label: '3.8', modelKey: 'gemini-3.8-flash' },
    ]);
    expect(axes.version?.activeId).toBe('3.6');
    expect(axes.checkpoint).toEqual({
      label: 'Variant',
      options: [{ id: 'Flash', label: 'Flash', modelKey: 'gemini-3.6-flash' }],
      activeId: 'Flash',
    });
  });

  it('reaches every catalog model by walking its own chips', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of MODEL_CATALOGS[provider]) {
        const axes = modelAxes({ model, selection: { key: model.key } });
        const group = axes.model.options.find((option) => option.id === axes.model.activeId);
        expect(group?.id, `${provider}/${model.key} has no chip of its own`).toBe(
          model.presentation.group,
        );
        const version = axes.version;
        if (version == null) {
          expect(group?.modelKey, `${provider}/${model.key} is shadowed by its own family`).toBe(
            model.key,
          );
          continue;
        }
        const picked = version.options.find((option) => option.id === version.activeId);
        const checkpoint = axes.checkpoint;
        if (checkpoint == null) {
          expect(picked?.modelKey, `${provider}/${model.key} is unreachable from its family`).toBe(
            model.key,
          );
          continue;
        }
        const variant = checkpoint.options.find((option) => option.id === checkpoint.activeId);
        expect(variant?.modelKey, `${provider}/${model.key} is unreachable from its version`).toBe(
          model.key,
        );
      }
    }
  });

  it('reports Max Mode from the resolved cursor combo', () => {
    const opus = CURSOR_CATALOG.find((candidate) => candidate.key === 'opus-5');
    const sonnet = CURSOR_CATALOG.find((candidate) => candidate.key === 'sonnet-4.6');
    if (opus == null || sonnet == null) {
      throw new Error('missing cursor Max Mode fixtures');
    }
    const opusSelection = {
      key: opus.key,
      effort: 'high',
      toggles: { thinking: true, fast: false },
    } satisfies ModelSelection;
    const sonnetSelection = {
      key: sonnet.key,
      toggles: { thinking: false, fast: false },
    } satisfies ModelSelection;
    expect(modelAxes({ model: opus, selection: opusSelection }).requiresMaxMode).toBe(true);
    expect(modelAxes({ model: sonnet, selection: sonnetSelection }).requiresMaxMode).toBe(false);
    expect(selectionRequiresMaxMode({ provider: 'cursor', selection: opusSelection })).toBe(true);
    expect(selectionRequiresMaxMode({ provider: 'cursor', selection: sonnetSelection })).toBe(
      false,
    );
  });
});
