import { describe, expect, it } from 'vitest';
import type { CatalogModel } from '@goodboy/types';
import { MODEL_CATALOGS } from '../catalogs';
import { modelHasEffortAxis } from '../modelHasEffortAxis';
import { SELECTABLE_AGENT_ROLES } from '../../roles';
import { TASKS } from '../../settings/tasks';
import { AUTO_DEFAULTS, type AutoChoice, type CuratedProviderId } from './defaults';

const PROVIDERS = Object.keys(AUTO_DEFAULTS).filter(
  (id): id is CuratedProviderId => id in AUTO_DEFAULTS,
);

const SLOTS = [...SELECTABLE_AGENT_ROLES, ...TASKS.map((task) => task.id)];

type CellParams = {
  readonly provider: CuratedProviderId;
  readonly choice: AutoChoice;
};

const modelOf = ({ provider, choice }: CellParams): CatalogModel | undefined => {
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
  return catalog.find((candidate) => candidate.key === choice.key);
};

const cells = PROVIDERS.flatMap((provider) =>
  SLOTS.flatMap((slot) =>
    AUTO_DEFAULTS[provider][slot].map((choice) => ({ provider, slot, choice })),
  ),
);

describe('AUTO_DEFAULTS', () => {
  it('gives every role and every task at least one pick on every curated provider', () => {
    for (const provider of PROVIDERS) {
      for (const slot of SLOTS) {
        expect(AUTO_DEFAULTS[provider][slot].length, `${provider} ${slot}`).toBeGreaterThan(0);
      }
    }
  });

  it('names only models the catalog carries, with an effort the model offers', () => {
    for (const { provider, slot, choice } of cells) {
      const model = modelOf({ provider, choice });
      expect(model, `${provider} ${slot} ${choice.key}`).toBeDefined();
      if (model == null || choice.effort == null) {
        continue;
      }
      if (model.provider === 'cursor') {
        expect(
          model.combos.some((combo) => combo.effort === choice.effort),
          `${provider} ${slot}`,
        ).toBe(true);
        continue;
      }
      if (!modelHasEffortAxis({ model })) {
        continue;
      }
      expect(model.efforts, `${provider} ${slot}`).toContain(choice.effort);
    }
  });

  it('never needs Max Mode for a cursor default', () => {
    for (const { provider, slot, choice } of cells) {
      const model = modelOf({ provider, choice });
      if (model?.provider !== 'cursor') {
        continue;
      }
      const combo = model.combos.find(
        (candidate) =>
          candidate.thinking === (choice.thinking === true) &&
          (choice.effort == null || candidate.effort === choice.effort),
      );
      expect(combo?.maxMode, `${slot} ${choice.key}`).toBe(false);
    }
  });

  it('keeps the Claude column of 0.5 except the picks this round changes on purpose', () => {
    const firstPick = (slot: (typeof SLOTS)[number]) => AUTO_DEFAULTS.anthropic[slot][0];
    expect(firstPick('scout')).toEqual({ key: 'haiku-4.5', effort: 'low' });
    expect(firstPick('implementer')).toEqual({ key: 'sonnet-5', effort: 'medium' });
    expect(firstPick('tester')).toEqual({ key: 'sonnet-5', effort: 'medium' });
    expect(firstPick('resolver')).toEqual({ key: 'sonnet-5', effort: 'medium' });
    expect(firstPick('wireframe')).toEqual({ key: 'sonnet-5', effort: 'medium' });
    expect(firstPick('rebase')).toEqual({ key: 'sonnet-5' });
    expect(firstPick('summarizer')).toEqual({ key: 'haiku-4.5' });
    expect(firstPick('investigator')).toEqual({ key: 'sonnet-5', effort: 'high' });
    expect(firstPick('reviewer')).toEqual({ key: 'sonnet-5', effort: 'high' });
    expect(firstPick('docs')).toEqual({ key: 'sonnet-5', effort: 'low' });
    expect(firstPick('report')).toEqual({ key: 'sonnet-5', effort: 'medium' });
    expect(firstPick('custom')).toEqual({ key: 'sonnet-5', effort: 'medium' });
    expect(firstPick('plan_generation')).toEqual({ key: 'sonnet-5', effort: 'medium' });
    expect(AUTO_DEFAULTS.anthropic.planner.map((choice) => choice.key)).toEqual([
      'opus-5.5',
      'opus-5',
    ]);
  });

  it('shows every change to the table in the diff', () => {
    expect(AUTO_DEFAULTS).toMatchSnapshot();
  });
});
