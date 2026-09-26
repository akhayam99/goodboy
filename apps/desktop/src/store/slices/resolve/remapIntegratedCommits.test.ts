import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolveThread, SessionId } from '@goodboy/types';
import type { CommitRangeParams, RangeCommit } from '../../../features/worktree/worktree';
import { remapIntegratedCommits } from './remapIntegratedCommits';

const h = vi.hoisted(() => ({
  setShas: vi.fn(async () => undefined),
  range: vi.fn<(params: CommitRangeParams) => Promise<ReadonlyArray<RangeCommit>>>(),
}));

vi.mock('@goodboy/db', () => ({ setResolveThreadCommitShas: h.setShas }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({ worktreeCommitRange: h.range }));

const SESSION = 'session' as SessionId;

const thread = { threadId: 'PRRT_1', commitShas: ['4f21c8b'] } as unknown as ResolveThread;

beforeEach(() => {
  h.setShas.mockClear();
  h.range.mockReset();
});

describe('remapIntegratedCommits', () => {
  it('records the cherry-picked sha on every thread the candidate covered', async () => {
    h.range.mockImplementation(async ({ head }) =>
      head === 'candidate'
        ? [{ sha: '4f21c8bfull', subject: 'Guard empty batches' }]
        : [{ sha: '9e8d7c6full', subject: 'Guard empty batches' }],
    );

    await remapIntegratedCommits({
      sessionId: SESSION,
      worktreePath: '/repos/ledger-core',
      baseSha: 'base',
      candidateSha: 'candidate',
      integratedSha: 'picked',
      threads: [thread],
    });

    expect(h.range).toHaveBeenCalledWith({
      worktreePath: '/repos/ledger-core',
      base: 'picked~1',
      head: 'picked',
    });
    expect(h.setShas).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION,
      threadId: 'PRRT_1',
      commitShas: ['9e8d7c6full'],
    });
  });

  it('reads nothing after a fast-forward', async () => {
    await remapIntegratedCommits({
      sessionId: SESSION,
      worktreePath: '/repos/ledger-core',
      baseSha: 'base',
      candidateSha: 'candidate',
      integratedSha: 'candidate',
      threads: [thread],
    });

    expect(h.range).not.toHaveBeenCalled();
    expect(h.setShas).not.toHaveBeenCalled();
  });
});
