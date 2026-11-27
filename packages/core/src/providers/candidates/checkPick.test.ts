import { describe, expect, it } from 'vitest';
import { MODEL_CATALOGS } from '../catalogs';
import { buildCandidates } from './buildCandidates';
import { candidateInputsOf } from './candidateFixtures';
import { checkPick, type CheckedPick } from './checkPick';
import type { CandidateInputs, CandidateNeed, CandidatePick } from './types';

const IMPLEMENTER: CandidateNeed = { role: 'implementer', size: 'medium', scope: 'helper' };

type CheckParams = {
  readonly inputs?: CandidateInputs;
  readonly need?: CandidateNeed;
  readonly pick: CandidatePick;
};

const check = ({
  inputs = candidateInputsOf({}),
  need = IMPLEMENTER,
  pick,
}: CheckParams): CheckedPick => checkPick({ list: buildCandidates({ inputs, need }), pick });

describe('checkPick', () => {
  it('keeps a Lead pick on a lower provider when it is a candidate', () => {
    const checked = check({ pick: { provider: 'codex', model: 'gpt-6.2-sol', effort: 'medium' } });
    expect(checked.kind).toBe('kept');
    expect(checked.kind === 'kept' && checked.candidate.provider).toBe('codex');
  });

  it('keeps a lighter model the Lead picked', () => {
    const checked = check({ pick: { provider: 'anthropic', model: 'haiku-5.5' } });
    expect(checked.kind === 'kept' && checked.candidate.isLighter).toBe(true);
  });

  it('moves a writer the Lead sent to Cursor to the best candidate and names the cause', () => {
    const checked = check({ pick: { provider: 'cursor', model: 'sonnet-5.5', effort: 'medium' } });
    expect(checked).toMatchObject({
      kind: 'moved',
      cause: 'writer',
      candidate: { provider: 'anthropic', model: 'sonnet-5.5' },
    });
  });

  it('moves a pick on a provider set to Off', () => {
    const checked = check({
      inputs: candidateInputsOf({ on: ['anthropic', 'codex'] }),
      pick: { provider: 'cursor', model: 'sonnet-5.5' },
    });
    expect(checked).toMatchObject({ kind: 'moved', cause: 'off' });
  });

  it('moves a pick on a provider cooling down', () => {
    const checked = check({
      inputs: candidateInputsOf({ coolingDown: ['codex'] }),
      pick: { provider: 'codex', model: 'gpt-6.2-sol' },
    });
    expect(checked).toMatchObject({ kind: 'moved', cause: 'cooldown' });
  });

  it('moves a model this build does not know', () => {
    expect(check({ pick: { provider: 'anthropic', model: 'sonnet-0.1' } })).toMatchObject({
      kind: 'moved',
      cause: 'unknown-model',
    });
    expect(check({ pick: { provider: 'northwind', model: 'sonnet-5.5' } })).toMatchObject({
      kind: 'moved',
      cause: 'unknown-model',
    });
  });

  it('moves a known model that is not a candidate for this step', () => {
    const checked = check({ pick: { provider: 'anthropic', model: 'opus-5.5' } });
    expect(checked).toMatchObject({ kind: 'moved', cause: 'not-listed' });
  });

  it('moves a pick whose effort is not on the list instead of changing the effort', () => {
    const checked = check({ pick: { provider: 'anthropic', model: 'sonnet-5.5', effort: 'max' } });
    expect(checked).toMatchObject({ kind: 'moved', cause: 'not-listed' });
  });

  it('moves a pinned model asked at another effort than the pin', () => {
    const checked = check({
      inputs: candidateInputsOf({
        rolePins: { implementer: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'high' } },
      }),
      pick: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'low' },
    });
    expect(checked).toMatchObject({
      kind: 'moved',
      cause: 'off-pin',
      candidate: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' },
    });
  });

  it('moves a pick outside the pinned models of the role', () => {
    const checked = check({
      inputs: candidateInputsOf({
        rolePins: { implementer: { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'high' } },
      }),
      pick: { provider: 'anthropic', model: 'sonnet-5.5' },
    });
    expect(checked).toMatchObject({
      kind: 'moved',
      cause: 'off-pin',
      candidate: { provider: 'codex', model: 'gpt-6.1-sol' },
    });
  });

  it('moves a review picked on the model family of the writer', () => {
    const checked = check({
      need: { role: 'reviewer', size: 'medium', scope: 'helper', writerFamily: 'claude' },
      pick: { provider: 'cursor', model: 'sonnet-5.5' },
    });
    expect(checked).toMatchObject({
      kind: 'moved',
      cause: 'same-family',
      candidate: { provider: 'codex' },
    });
  });

  it('refuses only when no candidate can run', () => {
    const checked = check({
      inputs: candidateInputsOf({ coolingDown: ['anthropic', 'codex'] }),
      pick: { provider: 'cursor', model: 'sonnet-5.5' },
    });
    expect(checked).toEqual({ kind: 'refused', cause: 'writer' });
  });

  it('spreads a batch by load when it moves a pick', () => {
    const inputs = candidateInputsOf({
      rule: 'load',
      room: {
        anthropic: { usedPercent: 20, isEstimated: false },
        codex: { usedPercent: 20, isEstimated: false },
      },
    });
    const checked = checkPick({
      list: buildCandidates({ inputs, need: IMPLEMENTER }),
      pick: { provider: 'cursor', model: 'sonnet-5.5' },
      batch: ['anthropic'],
    });
    expect(checked).toMatchObject({ kind: 'moved', candidate: { provider: 'codex' } });
  });
});

describe('a Lead pick the account cannot run', () => {
  const REFUSED = { anthropic: ['sonnet-5.5'] };
  const CODEX_FIRST = ['codex', 'anthropic', 'cursor'] as const;

  it('moves down the same provider instead of jumping to the first provider', () => {
    const checked = check({
      inputs: candidateInputsOf({ on: CODEX_FIRST, hidden: REFUSED, noAccess: REFUSED }),
      pick: { provider: 'anthropic', model: 'sonnet-5.5' },
    });

    expect(checked).toMatchObject({ kind: 'moved', cause: 'no-access' });
    expect(checked.kind === 'moved' && checked.candidate.provider).toBe('anthropic');
    expect(checked.kind === 'moved' && checked.candidate.model).not.toBe('sonnet-5.5');
  });

  it('keeps the provider order for a model hidden in Settings', () => {
    const checked = check({
      inputs: candidateInputsOf({ on: CODEX_FIRST, hidden: REFUSED }),
      pick: { provider: 'anthropic', model: 'sonnet-5.5' },
    });

    expect(checked).toMatchObject({ kind: 'moved', cause: 'not-listed' });
    expect(checked.kind === 'moved' && checked.candidate.provider).toBe('codex');
  });

  it('takes the first provider when the refused provider has nothing left', () => {
    const everything = { anthropic: MODEL_CATALOGS.anthropic.map((model) => model.key) };
    const checked = check({
      inputs: candidateInputsOf({ on: CODEX_FIRST, hidden: everything, noAccess: everything }),
      pick: { provider: 'anthropic', model: 'sonnet-5.5' },
    });

    expect(checked).toMatchObject({
      kind: 'moved',
      cause: 'no-access',
      candidate: { provider: 'codex' },
    });
  });
});
