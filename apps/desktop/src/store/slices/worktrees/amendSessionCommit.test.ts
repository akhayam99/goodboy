import type { AgentId, SessionId } from '@goodboy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  amendLocalCommit: vi.fn(async () => ({
    sha: 'new1234567',
    shortSha: 'new1234',
    replaced: ['old1234567'],
  })),
  squashLocalCommits: vi.fn(async () => ({
    sha: 'new1234567',
    shortSha: 'new1234',
    replaced: ['old1234567', 'older123456'],
  })),
  dequeueResolution: vi.fn(async () => undefined),
  queueResolution: vi.fn(async () => undefined),
}));

vi.mock('../../../features/worktree/worktree', () => ({
  amendLocalCommit: h.amendLocalCommit,
  squashLocalCommits: h.squashLocalCommits,
}));

import { amendSessionCommit } from './amendSessionCommit';
import { squashSessionCommits } from './squashSessionCommits';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

const setFn = () => (() => undefined) as unknown as SetFn;

const getFn = (worktrees: Record<string, ReadonlyArray<string>>): GetFn =>
  (() => ({ sessionWorktrees: worktrees, sessionPendingResolutions: {} })) as unknown as GetFn;

describe('local history rewrites', () => {
  beforeEach(() => {
    h.amendLocalCommit.mockClear();
    h.squashLocalCommits.mockClear();
    h.dequeueResolution.mockClear();
    h.queueResolution.mockClear();
  });

  it('amends on the primary worktree of the session', async () => {
    const get = getFn({ [SESSION_ID]: ['/tmp/wt', '/tmp/wt-2'] });

    const head = await amendSessionCommit(setFn(), get)(SESSION_ID, {
      sha: 'abc',
      message: 'reworded',
    });

    expect(head.shortSha).toBe('new1234');
    expect(h.amendLocalCommit).toHaveBeenCalledWith({
      worktreePath: '/tmp/wt',
      sha: 'abc',
      message: 'reworded',
    });
  });

  it('squashes on the primary worktree of the session', async () => {
    const get = getFn({ [SESSION_ID]: ['/tmp/wt'] });

    await squashSessionCommits(setFn(), get)(SESSION_ID, { sha: 'abc', message: 'one commit' });

    expect(h.squashLocalCommits).toHaveBeenCalledWith({
      worktreePath: '/tmp/wt',
      sha: 'abc',
      message: 'one commit',
    });
  });

  it('refuses to rewrite a session without a worktree', async () => {
    const get = getFn({});

    await expect(
      amendSessionCommit(setFn(), get)(SESSION_ID, { sha: 'abc', message: 'reworded' }),
    ).rejects.toThrow('no worktree');
    await expect(
      squashSessionCommits(setFn(), get)(SESSION_ID, { sha: 'abc', message: 'one commit' }),
    ).rejects.toThrow('no worktree');
    expect(h.amendLocalCommit).not.toHaveBeenCalled();
    expect(h.squashLocalCommits).not.toHaveBeenCalled();
  });

  it('repoints outcomes and queued resolutions onto the rewritten head', async () => {
    const state = {
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      resolverThreadOutcomes: {
        [AGENT_ID]: {
          PRRT_1: { kind: 'resolved', commitSha: 'old1234567' },
          PRRT_2: { kind: 'resolved', commitSha: 'untouched12' },
          PRRT_3: { kind: 'analyzed' },
        },
      },
      sessionPendingResolutions: {
        [SESSION_ID]: [
          {
            id: 'r1',
            sessionId: SESSION_ID,
            prNumber: 7,
            threadId: 'PRRT_1',
            commitSha: 'old1234567',
            createdAt: '2026-07-29T00:00:00.000Z',
          },
          {
            id: 'r2',
            sessionId: SESSION_ID,
            prNumber: 7,
            threadId: 'PRRT_2',
            commitSha: 'untouched12',
            createdAt: '2026-07-29T00:00:00.000Z',
          },
        ],
      },
      dequeueResolution: h.dequeueResolution,
      queueResolution: h.queueResolution,
    };
    const set = ((updater: (s: typeof state) => Partial<typeof state>) => {
      Object.assign(state, updater(state));
    }) as unknown as SetFn;
    const get = (() => state) as unknown as GetFn;

    await amendSessionCommit(set, get)(SESSION_ID, { sha: 'old1234567', message: 'reworded' });

    expect(state.resolverThreadOutcomes[AGENT_ID]).toEqual({
      PRRT_1: { kind: 'resolved', commitSha: 'new1234567' },
      PRRT_2: { kind: 'resolved', commitSha: 'untouched12' },
      PRRT_3: { kind: 'analyzed' },
    });
    expect(h.dequeueResolution).toHaveBeenCalledWith(SESSION_ID, 'PRRT_1');
    expect(h.queueResolution).toHaveBeenCalledWith(SESSION_ID, {
      threadId: 'PRRT_1',
      commitSha: 'new1234567',
      prNumber: 7,
    });
    expect(h.dequeueResolution).toHaveBeenCalledTimes(1);
  });
});
