import { describe, expect, it } from 'vitest';
import type { ResolveAttempt } from '@goodboy/types';
import { attemptNumberOf, previousAttemptsOf } from './attemptHistory';

const attempt = (fields: Partial<ResolveAttempt> & { readonly id: string }): ResolveAttempt =>
  ({
    threadIds: ['PRRT_1'],
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    effort: 'medium',
    phase: 'finished',
    error: null,
    createdAt: 1,
    ...fields,
  }) as ResolveAttempt;

describe('previousAttemptsOf', () => {
  it('lists earlier attempts for the thread in order and skips the active one', () => {
    const attempts = [
      attempt({ id: 'a2', createdAt: 20, phase: 'running' }),
      attempt({ id: 'a1', createdAt: 10, phase: 'failed', failureCause: 'provider_error' }),
      attempt({ id: 'other', createdAt: 15, threadIds: ['PRRT_2'] }),
    ];

    const previous = previousAttemptsOf({ attempts, threadId: 'PRRT_1', activeAttemptId: 'a2' });

    expect(previous).toHaveLength(1);
    expect(previous[0]).toMatchObject({
      id: 'a1',
      number: 1,
      outcome: 'failed',
      reason: 'The model provider stopped the run',
    });
  });

  it('says the cause is not recorded for an attempt written before causes existed', () => {
    const attempts = [
      attempt({ id: 'a1', createdAt: 10, phase: 'failed', error: 'interrupted' }),
      attempt({ id: 'a2', createdAt: 20, phase: 'running' }),
    ];

    const previous = previousAttemptsOf({ attempts, threadId: 'PRRT_1', activeAttemptId: 'a2' });

    expect(previous[0]).toMatchObject({ outcome: 'failed', reason: 'Cause not recorded' });
  });

  it('marks a stopped attempt and a finished one', () => {
    const attempts = [
      attempt({ id: 'a1', createdAt: 10, phase: 'cancelled' }),
      attempt({ id: 'a2', createdAt: 20 }),
      attempt({ id: 'a3', createdAt: 30, phase: 'running' }),
    ];

    const previous = previousAttemptsOf({ attempts, threadId: 'PRRT_1', activeAttemptId: 'a3' });

    expect(previous.map((entry) => [entry.number, entry.outcome, entry.reason])).toEqual([
      [1, 'stopped', 'You stopped it'],
      [2, 'finished', null],
    ]);
  });

  it('numbers the active attempt after the earlier ones', () => {
    const attempts = [attempt({ id: 'a1', createdAt: 10 }), attempt({ id: 'a2', createdAt: 20 })];
    expect(attemptNumberOf({ attempts, threadId: 'PRRT_1', attemptId: 'a2' })).toBe(2);
  });
});
