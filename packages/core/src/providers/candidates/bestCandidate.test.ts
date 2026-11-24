import { describe, expect, it } from 'vitest';
import { bestCandidate } from './bestCandidate';
import { buildCandidates } from './buildCandidates';
import { candidateInputsOf } from './candidateFixtures';
import type { Candidate, CandidateInputs, CandidateNeed } from './types';

const IMPLEMENTER: CandidateNeed = { role: 'implementer', size: 'medium', scope: 'helper' };

const SCOUT: CandidateNeed = { role: 'scout', size: 'large', scope: 'helper' };

type BestParams = {
  readonly inputs: CandidateInputs;
  readonly need?: CandidateNeed;
  readonly batch?: CandidateInputs['coolingDown'];
};

const best = ({ inputs, need = SCOUT, batch = [] }: BestParams): Candidate | null =>
  bestCandidate({ list: buildCandidates({ inputs, need }), batch });

describe('bestCandidate', () => {
  it('by order, gives the first provider the work while it has room', () => {
    const pick = best({
      inputs: candidateInputsOf({
        room: {
          anthropic: { usedPercent: 62, isEstimated: false },
          codex: { usedPercent: 10, isEstimated: false },
        },
      }),
    });
    expect([pick?.provider, pick?.isLighter]).toEqual(['anthropic', false]);
  });

  it('by order, moves to the next provider once the first is near its limit', () => {
    const pick = best({
      inputs: candidateInputsOf({ room: { anthropic: { usedPercent: 85, isEstimated: false } } }),
    });
    expect(pick?.provider).toBe('cursor');
  });

  it('by load, takes the provider with the most room left', () => {
    const pick = best({
      inputs: candidateInputsOf({
        rule: 'load',
        room: {
          anthropic: { usedPercent: 62, isEstimated: false },
          cursor: { usedPercent: 55, isEstimated: true },
          codex: { usedPercent: 18, isEstimated: false },
        },
      }),
    });
    expect(pick?.provider).toBe('codex');
  });

  it('by load, breaks a room tie on the agents started recently, then the order', () => {
    const inputs = candidateInputsOf({
      rule: 'load',
      room: {
        anthropic: { usedPercent: 20, isEstimated: false },
        cursor: { usedPercent: 20, isEstimated: true },
        codex: { usedPercent: 20, isEstimated: false },
      },
      load: { anthropic: 3, cursor: 1, codex: 1 },
    });
    expect(best({ inputs })?.provider).toBe('cursor');
  });

  it('by load, counts the picks already made in the same batch', () => {
    const inputs = candidateInputsOf({
      rule: 'load',
      room: {
        anthropic: { usedPercent: 20, isEstimated: false },
        cursor: { usedPercent: 20, isEstimated: true },
        codex: { usedPercent: 20, isEstimated: false },
      },
    });
    expect(best({ inputs })?.provider).toBe('anthropic');
    expect(best({ inputs, batch: ['anthropic'] })?.provider).toBe('cursor');
    expect(best({ inputs, batch: ['anthropic', 'cursor'] })?.provider).toBe('codex');
  });

  it('treats a provider with no reading as half used, never as empty', () => {
    const pick = best({
      inputs: candidateInputsOf({
        on: ['cursor', 'anthropic'],
        rule: 'load',
        room: { anthropic: { usedPercent: 30, isEstimated: false } },
      }),
    });
    expect(pick?.provider).toBe('anthropic');
  });

  it('never takes a guarded row', () => {
    const pick = best({
      inputs: candidateInputsOf({ on: ['cursor', 'anthropic'] }),
      need: IMPLEMENTER,
    });
    expect(pick?.provider).toBe('anthropic');
  });

  it('takes the first pinned model that can run, whatever the rule', () => {
    const pick = best({
      inputs: candidateInputsOf({
        rule: 'load',
        coolingDown: ['codex'],
        room: { anthropic: { usedPercent: 90, isEstimated: false } },
        rolePins: {
          scout: {
            providerId: 'codex',
            model: 'gpt-6.1-sol',
            effort: 'medium',
            models: [
              { providerId: 'codex', model: 'gpt-6.1-sol', effort: 'medium' },
              { providerId: 'anthropic', model: 'opus-5.5', effort: 'high' },
              { providerId: 'cursor', model: 'sonnet-5.5', effort: 'medium' },
            ],
          },
        },
      }),
    });
    expect([pick?.provider, pick?.model]).toEqual(['anthropic', 'opus-5.5']);
  });

  it('returns nothing when no candidate can run', () => {
    const pick = best({
      inputs: candidateInputsOf({ coolingDown: ['anthropic', 'cursor', 'codex'] }),
    });
    expect(pick).toBeNull();
  });
});
