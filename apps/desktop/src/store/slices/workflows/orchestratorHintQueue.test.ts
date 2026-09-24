import { describe, expect, it } from 'vitest';
import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';
import { consumeOrchestratorHints, formatOrchestratorHints } from './orchestratorHintQueue';

const AT = '2026-09-23T10:00:00.000Z' as IsoDateTime;
const LATER = '2026-09-23T10:05:00.000Z' as IsoDateTime;

const hint = (over: Partial<OrchestratorHint>): OrchestratorHint => ({
  id: 'hint',
  text: 'keep it to one PR',
  createdAt: AT,
  ...over,
});

describe('orchestratorHintQueue', () => {
  it('hands every hint to the decision, oldest first, marking the new ones', () => {
    const text = formatOrchestratorHints({
      hints: [
        hint({ id: 'old', text: 'no PR, commit locally', consumedAt: AT, consumedAtStep: 2 }),
        hint({ id: 'new', text: 'look at the payout domain first' }),
      ],
    });
    expect(text).toContain('- [since step 2] no PR, commit locally');
    expect(text).toContain('- [new] look at the payout domain first');
    expect(text.indexOf('no PR')).toBeLessThan(text.indexOf('payout'));
  });

  it('has nothing to say without hints', () => {
    expect(formatOrchestratorHints({ hints: [] })).toBe('');
  });

  it('stamps the first decision that read a hint and never restamps it', () => {
    const hints = [
      hint({ id: 'queued' }),
      hint({ id: 'old', consumedAt: AT, consumedAtStep: 1 }),
      hint({ id: 'late' }),
    ];
    const next = consumeOrchestratorHints({
      hints,
      readIds: new Set(['queued', 'old']),
      consumedAt: LATER,
      step: 3,
    });
    expect(next.find((entry) => entry.id === 'queued')).toMatchObject({
      consumedAt: LATER,
      consumedAtStep: 3,
    });
    expect(next.find((entry) => entry.id === 'old')?.consumedAtStep).toBe(1);
    expect(next.find((entry) => entry.id === 'late')?.consumedAt).toBeUndefined();
  });
});
