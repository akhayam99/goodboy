import { describe, expect, it } from 'vitest';
import type { ResolverThreadOutcome } from '../../store/types';
import { resolverCommitSha } from './resolverCommitSha';

const outcomes: Readonly<Record<string, ResolverThreadOutcome>> = {
  PRRT_1: { kind: 'resolved', commitSha: 'from-outcome' },
};

describe('resolverCommitSha', () => {
  it('prefers the sha already queued for the batch push', () => {
    const sha = resolverCommitSha({
      threadIds: ['PRRT_1'],
      outcomes,
      pendingResolutions: [{ threadId: 'PRRT_1', commitSha: 'from-queue' }],
      reportedSha: 'from-branch',
    });

    expect(sha).toBe('from-queue');
  });

  it('falls back to the sha attributed on the branch', () => {
    const sha = resolverCommitSha({
      threadIds: ['PRRT_1'],
      outcomes,
      pendingResolutions: [],
      reportedSha: 'from-branch',
    });

    expect(sha).toBe('from-branch');
  });

  it('reads the reported outcome when the branch says nothing', () => {
    const sha = resolverCommitSha({ threadIds: ['PRRT_1'], outcomes, pendingResolutions: [] });

    expect(sha).toBe('from-outcome');
  });

  it('ignores queued resolutions and outcomes of other threads', () => {
    const sha = resolverCommitSha({
      threadIds: ['PRRT_2'],
      outcomes,
      pendingResolutions: [{ threadId: 'PRRT_1', commitSha: 'from-queue' }],
    });

    expect(sha).toBeNull();
  });

  it('ignores outcomes that produced no commit', () => {
    const sha = resolverCommitSha({
      threadIds: ['PRRT_1'],
      outcomes: { PRRT_1: { kind: 'wontfix', reason: 'covered elsewhere' } },
      pendingResolutions: [],
    });

    expect(sha).toBeNull();
  });
});
