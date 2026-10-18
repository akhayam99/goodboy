import { describe, expect, it } from 'vitest';
import type { CatalogModel } from '@goodboy/types';
import { MODEL_CATALOGS } from '../catalogs';
import { modelHasEffortAxis } from '../modelHasEffortAxis';
import { SELECTABLE_AGENT_ROLES } from '../../roles';
import { TASKS } from '../../settings/tasks';
import { latestInGroup } from '../latestInGroup';
import { AUTO_DEFAULTS, AUTO_JOBS, type AutoChoice, type CuratedProviderId } from './defaults';

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

  it('keeps one cursor choice per cell that runs without Max Mode', () => {
    for (const slot of SLOTS) {
      const hasChoiceWithoutMaxMode = AUTO_DEFAULTS.cursor[slot].some((choice) => {
        const candidate = modelOf({ provider: 'cursor', choice });
        return (
          candidate?.provider === 'cursor' &&
          candidate.combos.some(
            (combo) =>
              combo.thinking === false &&
              (choice.effort == null || combo.effort === choice.effort) &&
              !combo.maxMode,
          )
        );
      });
      expect(hasChoiceWithoutMaxMode, slot).toBe(true);
    }
  });

  it('starts every cell on the newest non-legacy model of its line', () => {
    for (const provider of PROVIDERS) {
      for (const slot of SLOTS) {
        const job = AUTO_JOBS[provider][slot][0];
        if (job == null) {
          continue;
        }
        const newest = latestInGroup({ provider, group: job.group, checkpoint: job.checkpoint })[0];
        expect(AUTO_DEFAULTS[provider][slot][0]?.key, `${provider} ${slot}`).toBe(newest?.key);
      }
    }
  });

  it('keeps the older models of a line as the fallback after the newest', () => {
    expect(AUTO_DEFAULTS.anthropic.implementer.map((choice) => choice.key)).toEqual(
      latestInGroup({ provider: 'anthropic', group: 'Sonnet' }).map((model) => model.key),
    );
    expect(AUTO_DEFAULTS.anthropic.implementer.length).toBeGreaterThan(1);
  });

  it('never lists the same model twice in one cell', () => {
    for (const provider of PROVIDERS) {
      for (const slot of SLOTS) {
        const keys = AUTO_DEFAULTS[provider][slot].map((choice) => choice.key);
        expect(new Set(keys).size, `${provider} ${slot}`).toBe(keys.length);
      }
    }
  });
});
