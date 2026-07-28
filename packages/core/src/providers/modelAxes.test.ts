import { describe, expect, it } from 'vitest';
import type { ModelSelection } from '@goodboy/types';
import { ANTHROPIC_CATALOG } from './claude/catalog';
import { CODEX_CATALOG } from './codex/catalog';
import { CURSOR_CATALOG } from './cursor/catalog';
import { modelAxes } from './modelAxes';
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

  it('omits effort for anthropic models without authored efforts', () => {
    const model = ANTHROPIC_CATALOG.find((candidate) => candidate.key === 'haiku-4.5');
    if (model == null) {
      throw new Error('missing anthropic haiku-4.5');
    }
    expect(modelAxes({ model, selection: { key: model.key } }).effort).toBeNull();
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
