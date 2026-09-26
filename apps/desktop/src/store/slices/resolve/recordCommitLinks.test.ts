import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BranchCommit, ResolveThread, SessionId } from '@goodboy/types';
import type {
  CommitRangeParams,
  IsAncestorParams,
  RangeCommit,
} from '../../../features/worktree/worktree';
import { recordCommitLinks } from './recordCommitLinks';

const h = vi.hoisted(() => ({
  setLinks: vi.fn(async () => undefined),
  range: vi.fn<(params: CommitRangeParams) => Promise<ReadonlyArray<RangeCommit>>>(),
  branch: vi.fn<(path: string) => Promise<ReadonlyArray<BranchCommit>>>(),
  isAncestor: vi.fn<(params: IsAncestorParams) => Promise<boolean>>(),
}));

vi.mock('@goodboy/db', () => ({ setResolveThreadCommitLinks: h.setLinks }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({
  worktreeCommitRange: h.range,
  listBranchCommits: h.branch,
  worktreeIsAncestor: h.isAncestor,
}));

const SESSION = 'session' as SessionId;

const thread = (patch: Partial<ResolveThread>): ResolveThread =>
  ({
    threadId: 'PRRT_1',
    commitShas: ['9e8d7c6'],
    fixupOfSha: null,
    replacesSha: null,
    ...patch,
  }) as ResolveThread;

const capture = (threads: ReadonlyArray<ResolveThread>) =>
  recordCommitLinks({
    sessionId: SESSION,
    worktreePath: '/repos/payments-api',
    baseSha: 'base',
    candidateSha: 'tip',
    threads,
  });

beforeEach(() => {
  h.setLinks.mockClear();
  h.range.mockReset();
  h.branch.mockReset();
  h.isAncestor.mockReset();
  h.branch.mockResolvedValue([{ sha: '3a1f9c2full', subject: 'Add retry policy' } as BranchCommit]);
  h.isAncestor.mockResolvedValue(false);
});

describe('recordCommitLinks', () => {
  it('records the branch commit a fixup commit points at', async () => {
    h.range.mockResolvedValue([{ sha: '9e8d7c6full', subject: 'fixup! Add retry policy' }]);

    await capture([thread({})]);

    expect(h.setLinks).toHaveBeenCalledWith({
      db: {},
      sessionId: SESSION,
      threadId: 'PRRT_1',
      fixupOfSha: '3a1f9c2full',
      replacesSha: null,
    });
  });

  it('keeps the replaced commit when the revision amended it away', async () => {
    h.range.mockResolvedValue([{ sha: '9e8d7c6full', subject: 'Guard empty batches' }]);

    await capture([thread({ replacesSha: '4f21c8b' })]);

    expect(h.isAncestor).toHaveBeenCalledWith({
      worktreePath: '/repos/payments-api',
      sha: '4f21c8b',
      head: 'tip',
    });
    expect(h.setLinks).not.toHaveBeenCalled();
  });

  it('drops the replaced commit when the new fix sits on top of it', async () => {
    h.range.mockResolvedValue([{ sha: '9e8d7c6full', subject: 'Guard empty batches' }]);
    h.isAncestor.mockResolvedValue(true);

    await capture([thread({ replacesSha: '4f21c8b' })]);

    expect(h.setLinks).toHaveBeenCalledWith(
      expect.objectContaining({ fixupOfSha: null, replacesSha: null }),
    );
  });

  it('writes nothing for a normal commit or a thread without a commit', async () => {
    h.range.mockResolvedValue([{ sha: '9e8d7c6full', subject: 'Guard empty batches' }]);

    await capture([thread({}), thread({ threadId: 'PRRT_2', commitShas: null })]);

    expect(h.setLinks).not.toHaveBeenCalled();
  });
});
