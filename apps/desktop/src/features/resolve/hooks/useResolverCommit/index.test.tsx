// @vitest-environment happy-dom

const { listBranchCommits, worktreeIsAncestor } = vi.hoisted(() => ({
  listBranchCommits: vi.fn<(path: string) => Promise<ReadonlyArray<BranchCommit>>>(),
  worktreeIsAncestor: vi.fn<(params: IsAncestorParams) => Promise<boolean>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../worktree/worktree', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../worktree/worktree')>()),
  listBranchCommits,
  worktreeIsAncestor,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  BranchCommit,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { IsAncestorParams } from '../../../worktree/worktree';
import { useResolverCommit } from './index';

let useAppStore: StoryStore;

const SESSION_ID = 'session-commit' as SessionId;
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const MOUNT: SessionProjectMount = {
  mountId: 'mount-commit' as MountId,
  sessionId: SESSION_ID,
  projectId: 'project-commit' as ProjectId,
  mountName: 'ledger-core',
  worktreePath: '/work/ledger-core',
  lastWorktreePath: null,
  repoRoot: '/work/ledger-core',
  branch: 'hl/retry-lock',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const commitOf = ({ sha, subject }: { readonly sha: string; readonly subject: string }) => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject,
  author: 'resolver',
  timestamp: 1,
  pushed: false,
  parentSha: null,
});

const renderCommit = () =>
  renderHook(() => useResolverCommit({ sessionId: SESSION_ID, mountId: MOUNT.mountId, sha: SHA }));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessionProjectMounts: { [SESSION_ID]: [MOUNT] } });
  listBranchCommits.mockReset();
  worktreeIsAncestor.mockReset();
});

afterEach(cleanup);

describe('useResolverCommit', () => {
  it('keeps a commit older than the capped branch list on the branch', async () => {
    worktreeIsAncestor.mockResolvedValue(true);
    listBranchCommits.mockResolvedValue([
      commitOf({ sha: 'ffffffffffffffffffffffffffffffffffffffff', subject: 'Newest commit' }),
    ]);

    const { result } = renderCommit();

    await waitFor(() => expect(result.current?.isOnBranch).toBe(true));
    expect(result.current?.subject).toBeNull();
    expect(worktreeIsAncestor).toHaveBeenCalledWith({
      worktreePath: '/work/ledger-core',
      sha: SHA,
      head: 'HEAD',
    });
  });

  it('reads the subject from the list when the commit is in it', async () => {
    worktreeIsAncestor.mockResolvedValue(true);
    listBranchCommits.mockResolvedValue([commitOf({ sha: SHA, subject: 'Guard the retry lock' })]);

    const { result } = renderCommit();

    await waitFor(() => expect(result.current?.subject).toBe('Guard the retry lock'));
    expect(result.current?.isOnBranch).toBe(true);
  });

  it('is off the branch when HEAD does not contain the commit', async () => {
    worktreeIsAncestor.mockResolvedValue(false);
    listBranchCommits.mockResolvedValue([]);

    const { result } = renderCommit();

    await waitFor(() => expect(result.current?.isOnBranch).toBe(false));
  });

  it('still answers when the list fails', async () => {
    worktreeIsAncestor.mockResolvedValue(true);
    listBranchCommits.mockRejectedValue(new Error('list failed'));

    const { result } = renderCommit();

    await waitFor(() => expect(result.current?.isOnBranch).toBe(true));
    expect(result.current?.subject).toBeNull();
  });
});
