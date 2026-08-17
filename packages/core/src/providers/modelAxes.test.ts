import { describe, expect, it } from 'vitest';
import type { ModelSelection } from '@goodboy/types';
import { ANTHROPIC_CATALOG } from './claude/catalog';
import { CODEX_CATALOG } from './codex/catalog';
import { CURSOR_CATALOG } from './cursor/catalog';
import { modelAxes } from './modelAxes';
import { OPENCODE_CATALOG } from './opencode/catalog';
import { OPENROUTER_CATALOG } from './openrouter/catalog';
import { selectionRequiresMaxMode } from './selectionRequiresMaxMode';

describe('modelAxes', () => {
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

  it('exposes codex variants and honors the selected variant', () => {
    const model = CODEX_CATALOG.find((candidate) => candidate.key === 'gpt-5.6');
    if (model == null) {
      throw new Error('missing codex gpt-5.6');
    }
    const axes = modelAxes({
      model,
      selection: { key: model.key, variant: 'terra' },
    });
    expect(axes.variant).toEqual({
      label: 'Variant',
      options: [
        { id: 'sol', label: 'Sol' },
        { id: 'terra', label: 'Terra' },
        { id: 'luna', label: 'Luna' },
      ],
      activeId: 'terra',
    });
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

  it('keeps an unreachable effort axis empty instead of hiding it', () => {
    const model = ANTHROPIC_CATALOG.find((candidate) => candidate.key === 'haiku-4.5');
    if (model == null) {
      throw new Error('missing anthropic haiku-4.5');
    }
    const axes = modelAxes({ model, selection: { key: model.key } });
    expect(axes.effort).toEqual({ label: 'Effort', levels: [] });
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
