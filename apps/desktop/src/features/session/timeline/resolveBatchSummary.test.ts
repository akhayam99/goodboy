import { describe, expect, it } from 'vitest';
import type { ResolveAttemptLike, ResolveThreadFact } from './resolveActivity';
import {
  resolveBatchByAgentId,
  resolveBatchRowState,
  resolveBatchSummary,
  resolveBatchTitle,
} from './resolveBatchSummary';

const attempt = (overrides: Partial<ResolveAttemptLike> & { readonly agentId: string }) => ({
  batchId: null,
  launchId: null,
  provider: 'anthropic',
  mountTarget: { mountId: 'payments-api' },
  prNumber: 318,
  threadIds: [],
  phase: 'finished' as const,
  createdAt: 0,
  ...overrides,
});

describe('resolveBatchByAgentId', () => {
  it('groups the agents of one launch under its id', () => {
    const refs = resolveBatchByAgentId({
      attempts: [
        attempt({ agentId: 'a', launchId: 'launch-1' }),
        attempt({ agentId: 'b', launchId: 'launch-1', createdAt: 30 }),
        attempt({ agentId: 'c', launchId: 'launch-2' }),
      ],
    });
    expect(refs.get('a')?.batchId).toBe('launch-1');
    expect(refs.get('b')?.batchId).toBe('launch-1');
    expect(refs.get('c')?.batchId).toBe('launch-2');
  });

  it('reads the launch of an agent from its latest attempt, so a follow-up stays in the run', () => {
    const refs = resolveBatchByAgentId({
      attempts: [
        attempt({ agentId: 'a', launchId: 'launch-1', createdAt: 1 }),
        attempt({ agentId: 'a', launchId: 'launch-1', createdAt: 9, phase: 'running' }),
      ],
    });
    expect(refs.get('a')?.batchId).toBe('launch-1');
  });

  it('falls back to the batch id of attempts written before launch ids existed', () => {
    const refs = resolveBatchByAgentId({
      attempts: [
        attempt({ agentId: 'a', batchId: 'batch-1' }),
        attempt({ agentId: 'b', batchId: 'batch-1' }),
      ],
    });
    expect(refs.get('a')?.batchId).toBe('batch-1');
    expect(refs.get('b')?.batchId).toBe('batch-1');
  });

  it('leaves an attempt with no launch and no batch out of any group, whatever its PR', () => {
    const refs = resolveBatchByAgentId({
      attempts: Array.from({ length: 7 }, (_, index) =>
        attempt({ agentId: `r${index}`, createdAt: index }),
      ),
    });
    expect(refs.size).toBe(0);
  });
});

describe('resolve batch labels', () => {
  it('titles a fix run with the PR and the number of comments, never agents', () => {
    expect(resolveBatchTitle({ total: 7, prNumber: 318 })).toBe('Fix run · #318 · 7 comments');
    expect(resolveBatchTitle({ total: 1, prNumber: null })).toBe('Fix run · 1 comment');
  });
});

describe('resolveBatchSummary', () => {
  const thread = (state: ResolveThreadFact['state']): ResolveThreadFact => ({
    state,
    path: null,
    line: null,
  });

  it('counts the comments of every agent in five words, not the agents', () => {
    const summary = resolveBatchSummary({
      facts: [
        {
          state: 'needs',
          word: '9 comments',
          threads: [
            thread('ready'),
            thread('ready'),
            thread('edited'),
            thread('outdated'),
            thread('ready'),
            thread('needs'),
            thread('drafting'),
            thread('drafting'),
            thread('failed'),
          ],
        },
      ],
    });

    expect(summary.total).toBe(9);
    expect(summary.parts.map((part) => [part.state, part.count])).toEqual([
      ['ready', 5],
      ['needs_you', 1],
      ['working', 2],
      ['couldnt_fix', 1],
    ]);
    expect(summary.attentionCount).toBe(7);
    expect(summary.failedCount).toBe(1);
  });

  it('counts an agent without comment facts as one comment', () => {
    const summary = resolveBatchSummary({
      facts: [
        { state: 'pushed', word: 'Pushed' },
        { state: 'failed', word: "Couldn't fix" },
      ],
    });

    expect(summary.total).toBe(2);
    expect(summary.parts.map((part) => `${part.count} ${part.noun}`)).toEqual([
      '1 done',
      "1 couldn't fix",
    ]);
  });

  it('is waiting while something needs the owner, running while comments work, done otherwise', () => {
    const rowPhase = (states: ReadonlyArray<ResolveThreadFact['state']>) =>
      resolveBatchRowState({
        summary: resolveBatchSummary({
          facts: [{ state: states[0] ?? 'new', word: '', threads: states.map(thread) }],
        }),
      }).phase;

    expect(rowPhase(['drafting', 'ready'])).toBe('waiting');
    expect(rowPhase(['drafting', 'pushed'])).toBe('running');
    expect(rowPhase(['pushed', 'skipped'])).toBe('done');
  });
});
