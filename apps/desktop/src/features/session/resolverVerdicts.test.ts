import { describe, expect, it } from 'vitest';
import { resolverVerdicts } from './resolverVerdicts';

describe('resolverVerdicts', () => {
  it('reads the wontfix reason as the prose and keeps the reply beside it', () => {
    const verdicts = resolverVerdicts({
      threadIds: ['PRRT_1'],
      outcomes: {
        PRRT_1: { kind: 'wontfix', reason: 'covered upstream', reply: 'Already guarded there' },
      },
    });

    expect(verdicts).toEqual([
      { threadId: 'PRRT_1', prose: 'covered upstream', reply: 'Already guarded there' },
    ]);
  });

  it('never repeats an analysis summary as its own reply', () => {
    const verdicts = resolverVerdicts({
      threadIds: ['PRRT_1'],
      outcomes: { PRRT_1: { kind: 'analyzed', reply: 'Use the shared helper' } },
    });

    expect(verdicts).toEqual([{ threadId: 'PRRT_1', prose: 'Use the shared helper', reply: null }]);
  });

  it('keeps a committed thread only for the reply it will post', () => {
    const verdicts = resolverVerdicts({
      threadIds: ['PRRT_1', 'PRRT_2'],
      outcomes: {
        PRRT_1: { kind: 'resolved', commitSha: 'abc1234', reply: 'Fixed in abc1234' },
        PRRT_2: { kind: 'resolved', commitSha: 'def5678' },
      },
    });

    expect(verdicts).toEqual([{ threadId: 'PRRT_1', prose: null, reply: 'Fixed in abc1234' }]);
  });

  it('says nothing when the agent produced nothing', () => {
    expect(resolverVerdicts({ threadIds: ['PRRT_1'], outcomes: {} })).toEqual([]);
  });
});
