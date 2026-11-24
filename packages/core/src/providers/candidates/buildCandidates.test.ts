import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import type { CliRequirement } from '../cliGate';
import { CODEX_CATALOG } from '../codex/catalog';
import { buildCandidates } from './buildCandidates';
import { candidateInputsOf } from './candidateFixtures';
import type { CandidateInputs, CandidateList, CandidateNeed } from './types';

const IMPLEMENTER: CandidateNeed = { role: 'implementer', size: 'medium', scope: 'helper' };

const SCOUT: CandidateNeed = { role: 'scout', size: 'medium', scope: 'helper' };

type CauseParams = {
  readonly list: CandidateList;
  readonly provider: ProviderId;
};

const causesOf = ({ list, provider }: CauseParams): ReadonlyArray<string | null> => [
  ...list.rows.filter((row) => row.provider === provider).map((row) => row.cause),
  ...list.excluded.filter((entry) => entry.provider === provider).map((entry) => entry.cause),
];

type BuildParams = {
  readonly inputs: CandidateInputs;
  readonly need?: CandidateNeed;
};

const build = ({ inputs, need = SCOUT }: BuildParams): CandidateList =>
  buildCandidates({ inputs, need });

describe('buildCandidates', () => {
  it('offers every On provider in the user order, not only the first one', () => {
    const list = build({ inputs: candidateInputsOf({}) });
    const valid = list.rows.filter((row) => row.cause === null);
    expect([...new Set(valid.map((row) => row.provider))]).toEqual([
      'anthropic',
      'cursor',
      'codex',
    ]);
    expect(valid.map((row) => row.order)).toEqual(valid.map((row) => row.order).sort());
  });

  it('offers the rung for the role and size plus one lighter rung per provider', () => {
    const list = build({ inputs: candidateInputsOf({ on: ['anthropic'] }), need: IMPLEMENTER });
    expect(list.rows.map((row) => [row.model, row.effort, row.rung, row.isLighter])).toEqual([
      ['sonnet-5.5', 'medium', 'standard', false],
      ['haiku-5.5', 'medium', 'light', true],
    ]);
  });

  it('never offers a rung below the lowest one the role may take', () => {
    const list = build({
      inputs: candidateInputsOf({ on: ['anthropic'] }),
      need: { role: 'planner', size: 'small', scope: 'helper' },
    });
    expect(list.rows.map((row) => row.rung)).toEqual(['hard']);
  });

  it('keeps Gemini and Copilot, which have no curated column for every provider', () => {
    const list = build({ inputs: candidateInputsOf({ on: ['gemini', 'copilot'] }) });
    expect([...new Set(list.rows.map((row) => row.provider))]).toEqual(['gemini', 'copilot']);
    expect(list.rows.every((row) => row.cause === null)).toBe(true);
  });

  it('strikes a disconnected provider', () => {
    const list = build({ inputs: candidateInputsOf({ connected: ['anthropic', 'codex'] }) });
    expect(causesOf({ list, provider: 'cursor' })).toEqual(['not-connected']);
  });

  it('leaves out a provider set to Off', () => {
    const list = build({ inputs: candidateInputsOf({ on: ['anthropic', 'codex'] }) });
    expect(causesOf({ list, provider: 'cursor' })).toEqual(['off']);
  });

  it('keeps a Backup provider idle while an On provider can work', () => {
    const list = build({ inputs: candidateInputsOf({ on: ['anthropic'], backup: ['codex'] }) });
    expect(causesOf({ list, provider: 'codex' })).toEqual(['backup-idle']);
  });

  it('opens a Backup provider once every On provider is cooling down', () => {
    const list = build({
      inputs: candidateInputsOf({
        on: ['anthropic'],
        backup: ['codex'],
        coolingDown: ['anthropic'],
      }),
    });
    expect(causesOf({ list, provider: 'codex' }).every((cause) => cause === null)).toBe(true);
  });

  it('opens a Backup provider when every fitting model on the On provider is hidden', () => {
    const list = build({
      inputs: candidateInputsOf({
        on: ['codex'],
        backup: ['anthropic'],
        hidden: { codex: CODEX_CATALOG.map((model) => model.key) },
      }),
    });
    expect(causesOf({ list, provider: 'anthropic' }).every((cause) => cause === null)).toBe(true);
  });

  it('strikes a provider out of room', () => {
    const list = build({ inputs: candidateInputsOf({ atLimit: ['anthropic'] }) });
    expect(new Set(causesOf({ list, provider: 'anthropic' }))).toEqual(new Set(['at-limit']));
  });

  it('keeps a provider out of room when the user keeps it after its limit', () => {
    const inputs = candidateInputsOf({ atLimit: ['anthropic'] });
    const list = build({
      inputs: {
        ...inputs,
        policy: (inputs.policy ?? []).map((entry) =>
          entry.id === 'anthropic' ? { ...entry, keepAfterLimit: true } : entry,
        ),
      },
    });
    expect(new Set(causesOf({ list, provider: 'anthropic' }))).toEqual(new Set([null]));
  });

  it('strikes a provider cooling down', () => {
    const list = build({ inputs: candidateInputsOf({ coolingDown: ['codex'] }) });
    expect(new Set(causesOf({ list, provider: 'codex' }))).toEqual(new Set(['cooldown']));
  });

  it('strikes a provider whose breaker is open', () => {
    const list = build({ inputs: candidateInputsOf({ breakerOpen: ['cursor'] }) });
    expect(new Set(causesOf({ list, provider: 'cursor' }))).toEqual(new Set(['breaker']));
  });

  it('strikes a provider with a budget alert', () => {
    const list = build({ inputs: candidateInputsOf({ budgetBlocked: ['codex'] }) });
    expect(new Set(causesOf({ list, provider: 'codex' }))).toEqual(new Set(['budget']));
  });

  it('strikes a provider that is not one of the providers for this run', () => {
    const list = build({ inputs: candidateInputsOf({ runProviders: ['anthropic', 'codex'] }) });
    expect(new Set(causesOf({ list, provider: 'cursor' }))).toEqual(new Set(['outside-run']));
  });

  it('strikes a provider the Lead never starts agents on, and keeps it for a workflow step', () => {
    const inputs = candidateInputsOf({ on: ['anthropic', 'opencode'] });
    const helper = build({ inputs });
    const step = build({ inputs, need: { ...SCOUT, scope: 'step' } });
    expect(new Set(causesOf({ list: helper, provider: 'opencode' }))).toEqual(
      new Set(['not-for-helpers']),
    );
    expect(new Set(causesOf({ list: step, provider: 'opencode' }))).toEqual(new Set([null]));
  });

  it('strikes Cursor for an agent that writes code, and not for a reader', () => {
    const writer = build({ inputs: candidateInputsOf({}), need: IMPLEMENTER });
    const reader = build({ inputs: candidateInputsOf({}) });
    expect(new Set(causesOf({ list: writer, provider: 'cursor' }))).toEqual(new Set(['writer']));
    expect(new Set(causesOf({ list: reader, provider: 'cursor' }))).toEqual(new Set([null]));
  });

  it('applies the writer rule to Lead helpers only', () => {
    const list = build({ inputs: candidateInputsOf({}), need: { ...IMPLEMENTER, scope: 'step' } });
    expect(new Set(causesOf({ list, provider: 'cursor' }))).toEqual(new Set([null]));
  });

  it('says a provider is left out when every fitting model there is hidden', () => {
    const list = build({
      inputs: candidateInputsOf({ hidden: { codex: CODEX_CATALOG.map((model) => model.key) } }),
    });
    expect(causesOf({ list, provider: 'codex' })).toEqual(['hidden']);
  });

  it('says a provider is left out when its CLI is too old for every fitting model', () => {
    const list = build({
      inputs: candidateInputsOf({
        cliVersions: { codex: '0.0.1' },
        learned: CODEX_CATALOG.map((model): CliRequirement => ({
          providerId: 'codex',
          modelKey: model.key,
          requiredVersion: '99.0.0',
        })),
      }),
    });
    expect(causesOf({ list, provider: 'codex' })).toEqual(['cli-too-old']);
  });

  it('lists only the pinned models when a role has a pin', () => {
    const list = build({
      inputs: candidateInputsOf({
        rolePins: {
          scout: {
            providerId: 'codex',
            model: 'gpt-6.1-sol',
            effort: 'medium',
            models: [
              { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'medium' },
              { providerId: 'anthropic', model: 'opus-5.5', effort: 'high' },
            ],
          },
        },
      }),
    });
    expect(list.isPinned).toBe(true);
    expect(list.rows.map((row) => [row.provider, row.model])).toEqual([
      ['codex', 'gpt-6.1-sol'],
      ['anthropic', 'opus-5.5'],
    ]);
  });

  it('falls back to every candidate when no pinned model can run', () => {
    const list = build({
      inputs: candidateInputsOf({
        on: ['anthropic', 'cursor'],
        rolePins: { scout: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'medium' } },
      }),
    });
    expect(list.isPinned).toBe(false);
    expect(list.rows.some((row) => row.provider === 'anthropic')).toBe(true);
  });

  it('strikes a pinned model the installed CLI is too old for', () => {
    const list = build({
      inputs: candidateInputsOf({
        cliVersions: { codex: '0.0.1' },
        learned: CODEX_CATALOG.map((model): CliRequirement => ({
          providerId: 'codex',
          modelKey: model.key,
          requiredVersion: '99.0.0',
        })),
        rolePins: {
          scout: {
            providerId: 'codex',
            model: 'gpt-6.1-sol',
            effort: 'medium',
            models: [
              { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'medium' },
              { providerId: 'anthropic', model: 'opus-5.5', effort: 'high' },
            ],
          },
        },
      }),
    });
    expect(list.isPinned).toBe(true);
    expect(causesOf({ list, provider: 'codex' })).toEqual(['cli-too-old']);
    expect(causesOf({ list, provider: 'anthropic' })).toEqual([null]);
  });

  it('strikes the writer family among the pinned models of a reviewer', () => {
    const list = build({
      inputs: candidateInputsOf({
        rolePins: {
          reviewer: {
            providerId: 'anthropic',
            model: 'opus-5.5',
            effort: 'high',
            models: [
              { providerId: 'anthropic', model: 'opus-5.5', effort: 'high' },
              { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'medium' },
            ],
          },
        },
      }),
      need: { role: 'reviewer', size: 'medium', scope: 'helper', writerFamily: 'claude' },
    });
    expect(list.isPinned).toBe(true);
    expect(causesOf({ list, provider: 'anthropic' })).toEqual(['same-family']);
    expect(causesOf({ list, provider: 'codex' })).toEqual([null]);
    expect(list.isSameFamilyKept).toBe(false);
  });

  it('strikes the model family of the writer when the agent reviews a change', () => {
    const list = build({
      inputs: candidateInputsOf({}),
      need: { role: 'reviewer', size: 'medium', scope: 'helper', writerFamily: 'gpt' },
    });
    expect(new Set(causesOf({ list, provider: 'codex' }))).toEqual(new Set(['same-family']));
    expect(list.rows.some((row) => row.provider === 'anthropic' && row.cause === null)).toBe(true);
    expect(list.isSameFamilyKept).toBe(false);
  });

  it('keeps the writer family and says so when no other family is left', () => {
    const list = build({
      inputs: candidateInputsOf({ on: ['codex'] }),
      need: { role: 'reviewer', size: 'medium', scope: 'helper', writerFamily: 'gpt' },
    });
    expect(list.isSameFamilyKept).toBe(true);
    expect(list.rows.every((row) => row.cause === null)).toBe(true);
  });

  it('carries the room, the load and the published rate on every row', () => {
    const list = build({
      inputs: candidateInputsOf({
        on: ['anthropic'],
        room: { anthropic: { usedPercent: 62, isEstimated: false } },
        load: { anthropic: 3 },
      }),
    });
    const [first] = list.rows;
    expect(first?.room).toEqual({ usedPercent: 62, isEstimated: false });
    expect(first?.load).toBe(3);
    expect(first?.price).not.toBeNull();
    expect(first?.family).toBe('claude');
  });
});
