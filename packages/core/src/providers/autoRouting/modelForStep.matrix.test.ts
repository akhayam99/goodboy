import { describe, expect, it } from 'vitest';
import type { StepSize } from '@goodboy/types';
import { MODEL_CATALOGS } from '../catalogs';
import { resolvedStoredModelId } from '../resolvedStoredModelId';
import { SELECTABLE_AGENT_ROLES } from '../../roles';
import { TASKS } from '../../settings/tasks';
import { AUTO_RUNG_CHOICES, type AutoSlotId, type CuratedProviderId } from './defaults';
import { RUNGS } from './effortLadder';
import { modelForStep } from './modelForStep';
import { lowestRungOf, rungForStep } from './slotRungs';

const PROVIDERS: ReadonlyArray<CuratedProviderId> = ['anthropic', 'codex', 'gemini', 'cursor'];

const SIZES: ReadonlyArray<StepSize | null> = [null, 'small', 'large'];

const ROLE_SLOTS = SELECTABLE_AGENT_ROLES.map((id) => ({ kind: 'role', id }) as const);

const TASK_SLOTS = TASKS.map((task) => ({ kind: 'task', id: task.id }) as const);

const PLANNER = { kind: 'role', id: 'planner' } as const;

const IMPLEMENTER = { kind: 'role', id: 'implementer' } as const;

type KeysParams = {
  readonly provider: CuratedProviderId;
  readonly keys: ReadonlyArray<string>;
};

const hiddenKeys = ({ provider, keys }: KeysParams) => ({
  [provider]: MODEL_CATALOGS[provider]
    .map((model) => model.key)
    .filter((key) => keys.some((prefix) => key.startsWith(prefix))),
});

type FirstParams = {
  readonly provider: CuratedProviderId;
  readonly slot: AutoSlotId;
  readonly size: StepSize | null;
};

const firstChoiceOf = ({ provider, slot, size }: FirstParams) => {
  const [first] = AUTO_RUNG_CHOICES[provider][rungForStep({ slot, size })];
  return first;
};

describe('modelForStep matrix: role by size by provider', () => {
  it('runs every role and every size on the preferred provider, on the rung the size names', () => {
    for (const provider of PROVIDERS) {
      for (const slot of ROLE_SLOTS) {
        for (const size of SIZES) {
          const pick = modelForStep({
            slot,
            size,
            defaultProvider: provider,
            connected: [provider],
            isCursorMaxModeOn: true,
          });
          const label = `${provider} ${slot.id} ${String(size)}`;
          const first = firstChoiceOf({ provider, slot: slot.id, size });
          expect(pick?.provider, label).toBe(provider);
          expect(pick?.rung, label).toBe(rungForStep({ slot: slot.id, size }));
          expect(pick?.step, label).toBe('curated');
          expect(pick?.model, label).toBe(
            resolvedStoredModelId({
              provider,
              selection: { key: first?.key ?? '', effort: first?.effort },
            }),
          );
          expect(pick?.effort ?? null, label).toBe(first?.effort ?? null);
        }
      }
    }
  });

  it('never climbs a rung for a small step and never drops one for a large step', () => {
    const positions = (size: StepSize | null, slot: AutoSlotId): number =>
      RUNGS.indexOf(rungForStep({ slot, size }));
    for (const slot of ROLE_SLOTS) {
      expect(positions('small', slot.id), slot.id).toBeLessThanOrEqual(positions(null, slot.id));
      expect(positions('large', slot.id), slot.id).toBeGreaterThanOrEqual(positions(null, slot.id));
    }
  });

  it('keeps a background task on one model whatever the size', () => {
    for (const provider of PROVIDERS) {
      for (const slot of TASK_SLOTS) {
        const models = SIZES.map(
          (size) =>
            modelForStep({
              slot,
              size,
              defaultProvider: provider,
              connected: [provider],
              isCursorMaxModeOn: true,
            })?.model,
        );
        expect(new Set(models).size, `${provider} ${slot.id}`).toBe(1);
      }
    }
  });

  it('puts a small implementer on Haiku, a normal one on Sonnet and a large one on Sonnet High', () => {
    const run = (size: StepSize | null) =>
      modelForStep({ slot: IMPLEMENTER, size, defaultProvider: 'anthropic' });
    expect(run('small')).toMatchObject({ model: 'haiku-5.5', effort: 'medium', rung: 'light' });
    expect(run(null)).toMatchObject({ model: 'sonnet-5.5', effort: 'medium', rung: 'standard' });
    expect(run('large')).toMatchObject({ model: 'sonnet-5.5', effort: 'high', rung: 'hard' });
  });

  it('keeps the planner on Hard or above for a small step', () => {
    for (const provider of PROVIDERS) {
      const pick = modelForStep({
        slot: PLANNER,
        size: 'small',
        defaultProvider: provider,
        connected: [provider],
        isCursorMaxModeOn: true,
      });
      expect(RUNGS.indexOf(pick?.rung ?? 'quick'), provider).toBeGreaterThanOrEqual(
        RUNGS.indexOf(lowestRungOf({ slot: PLANNER })),
      );
    }
  });
});

describe('modelForStep matrix: an older CLI', () => {
  it('takes the older model of the same line, on the same rung', () => {
    const pick = modelForStep({
      slot: { kind: 'task', id: 'summarizer' },
      defaultProvider: 'anthropic',
      cliVersions: { anthropic: '2.1.292' },
    });
    expect(pick).toMatchObject({
      provider: 'anthropic',
      model: 'haiku-4.5',
      rung: 'quick',
      step: 'next-in-column',
    });
  });

  it('takes GPT-6.1 Sol or the older Sol on Codex before it changes rung', () => {
    const pick = modelForStep({
      slot: IMPLEMENTER,
      defaultProvider: 'codex',
      connected: ['codex'],
      cliVersions: { codex: '0.161.0' },
    });
    expect(pick).toMatchObject({ provider: 'codex', model: 'gpt-6.1-sol', rung: 'standard' });
    const older = modelForStep({
      slot: IMPLEMENTER,
      defaultProvider: 'codex',
      connected: ['codex'],
      cliVersions: { codex: '0.150.0' },
    });
    expect(older).toMatchObject({ provider: 'codex', model: 'gpt-5.6-sol', rung: 'standard' });
  });
});

describe('modelForStep matrix: a provider that cannot work', () => {
  it('sends the step to the next provider at the same rung when the preferred one is at its limit', () => {
    for (const size of SIZES) {
      const pick = modelForStep({
        slot: IMPLEMENTER,
        size,
        defaultProvider: 'anthropic',
        fallbackOrder: ['anthropic', 'codex'],
        connected: ['anthropic', 'codex'],
        atLimit: ['anthropic'],
      });
      expect(pick, String(size)).toMatchObject({
        provider: 'codex',
        step: 'next-provider',
        rung: rungForStep({ slot: 'implementer', size }),
        skippedAtLimit: ['anthropic'],
      });
    }
  });

  it('refuses when no provider is left', () => {
    expect(
      modelForStep({
        slot: IMPLEMENTER,
        size: 'large',
        defaultProvider: 'anthropic',
        connected: ['anthropic'],
        atLimit: ['anthropic'],
      }),
    ).toBeNull();
  });
});

describe('modelForStep matrix: a rung the provider cannot run', () => {
  it('drops the planner from Top to Hard on the same provider when Opus is hidden', () => {
    const pick = modelForStep({
      slot: PLANNER,
      defaultProvider: 'anthropic',
      hidden: hiddenKeys({ provider: 'anthropic', keys: ['opus'] }),
    });
    expect(pick).toMatchObject({
      provider: 'anthropic',
      model: 'sonnet-5.5',
      effort: 'high',
      rung: 'hard',
      step: 'next-in-column',
    });
  });

  it('never drops an agent role to the Quick rung', () => {
    const pick = modelForStep({
      slot: IMPLEMENTER,
      size: 'small',
      defaultProvider: 'anthropic',
      hidden: hiddenKeys({ provider: 'anthropic', keys: ['haiku'] }),
    });
    expect(pick?.provider).toBe('anthropic');
    expect(pick?.model.startsWith('haiku')).toBe(false);
  });

  it('climbs for a large step when its rung is hidden', () => {
    const pick = modelForStep({
      slot: IMPLEMENTER,
      size: 'large',
      defaultProvider: 'anthropic',
      hidden: hiddenKeys({ provider: 'anthropic', keys: ['sonnet', 'haiku'] }),
    });
    expect(pick).toMatchObject({ provider: 'anthropic', rung: 'top' });
  });

  it('moves a Cursor Top step to Sonnet Very high while Max Mode is off', () => {
    const pick = modelForStep({
      slot: PLANNER,
      defaultProvider: 'cursor',
      connected: ['cursor'],
      isCursorMaxModeOn: false,
    });
    expect(pick).toMatchObject({
      provider: 'cursor',
      model: 'sonnet-5.5',
      effort: 'xhigh',
      rung: 'top',
    });
    const withMaxMode = modelForStep({
      slot: PLANNER,
      defaultProvider: 'cursor',
      connected: ['cursor'],
      isCursorMaxModeOn: true,
    });
    expect(withMaxMode).toMatchObject({ model: 'opus-5.5', effort: 'high' });
  });

  it('moves a Cursor Light task to Auto while Max Mode is off', () => {
    const pick = modelForStep({
      slot: { kind: 'task', id: 'recheck' },
      defaultProvider: 'cursor',
      connected: ['cursor'],
      isCursorMaxModeOn: false,
    });
    expect(pick).toMatchObject({ provider: 'cursor', model: 'auto', rung: 'light' });
  });
});
