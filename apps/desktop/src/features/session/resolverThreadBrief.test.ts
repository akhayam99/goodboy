import { describe, expect, it } from 'vitest';
import { resolverThreadBrief } from './resolverThreadBrief';
import type { ResolverThreadSettlement } from './resolverThreadSettlements';

const settlement = (over: Partial<ResolverThreadSettlement>): ResolverThreadSettlement => ({
  threadId: 'PRRT_1',
  kind: 'analyzed',
  commitSha: null,
  reason: null,
  reply: null,
  isQueued: false,
  isClosed: false,
  ...over,
});

describe('resolverThreadBrief', () => {
  it('summarizes the ask, the verdict and what is left to decide', () => {
    const brief = resolverThreadBrief({
      settlement: settlement({ kind: 'wontfix', reason: 'The branch is unreachable. Details.' }),
      commentBody: '### Add a guard clause here. It crashes on null.',
      prNumber: 7,
      isBusy: false,
    });

    expect(brief.ask).toBe('Add a guard clause here.');
    expect(brief.verdict).toBe('No change needed: The branch is unreachable. Details.');
    expect(brief.next).toContain('not worth a change');
  });

  it('names the outcome without a detail when the agent wrote nothing', () => {
    const brief = resolverThreadBrief({
      settlement: settlement({ kind: 'open' }),
      commentBody: null,
      prNumber: null,
      isBusy: false,
    });

    expect(brief.ask).toBe('');
    expect(brief.verdict).toBe('No outcome recorded');
    expect(brief.next).toBe('The agent recorded no outcome for this thread.');
  });

  it('reads a closed thread as nothing left to decide', () => {
    const brief = resolverThreadBrief({
      settlement: settlement({ kind: 'resolved', commitSha: 'abc1234', isClosed: true }),
      commentBody: 'Fix the typo',
      prNumber: 7,
      isBusy: false,
    });

    expect(brief.verdict).toBe('Committed a fix');
    expect(brief.next).toBe('Closed on GitHub, nothing left to decide.');
  });
});
