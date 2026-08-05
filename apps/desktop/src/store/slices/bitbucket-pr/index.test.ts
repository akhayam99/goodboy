import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { BitbucketPullRequest } from '../../../features/integrations/bitbucket/client';

const pullRequestForBranchSpy = vi.fn();
const getPullRequestSpy = vi.fn();
const remoteUrlSpy = vi.fn(async () => 'git@bitbucket.org:acme/rocket.git');

vi.mock('../../../features/integrations/bitbucket/client', () => ({
  bitbucketPullRequestForBranch: (...args: ReadonlyArray<unknown>) =>
    pullRequestForBranchSpy(...args),
  bitbucketGetPullRequest: (...args: ReadonlyArray<unknown>) => getPullRequestSpy(...args),
}));

vi.mock('../../../features/worktree/worktree', () => ({
  worktreeRemoteUrl: () => remoteUrlSpy(),
}));

vi.mock('../worktrees/getSessionRepo', () => ({
  getSessionRepo: () => ({
    repoRoot: '/repos/rocket',
    worktreePath: '/repos/rocket',
    branch: 'ak/feat-thing',
    mountName: null,
    workspaceId: 'ws-1' as WorkspaceId,
  }),
}));

const { createBitbucketPrSlice, initialBitbucketPrState } = await import('./index');

const SESSION_ID = 'sess-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const buildPr = (id: number): BitbucketPullRequest => ({
  id,
  title: `pull request ${id}`,
  description: '',
  state: 'OPEN',
  createdOn: '2026-08-01T10:00:00Z',
  updatedOn: '2026-08-01T11:00:00Z',
  sourceBranch: 'ak/feat-thing',
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: null,
});

type TestState = Record<string, unknown>;

const buildStore = () => {
  let state: TestState = {
    ...initialBitbucketPrState,
    sessions: [{ id: SESSION_ID, workspaceId: WORKSPACE_ID, goal: 'ship it' }],
    workspaceIntegrations: {
      [WORKSPACE_ID]: [
        {
          provider: 'bitbucket',
          config: { workspaceSlug: 'acme', email: 'dev@acme.test' },
        },
      ],
    },
  };
  const set = (partial: unknown) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...(next as TestState) };
  };
  const get = () => state as unknown as AppStore;
  const slice = createBitbucketPrSlice(
    set as Parameters<typeof createBitbucketPrSlice>[0],
    get as Parameters<typeof createBitbucketPrSlice>[1],
  );
  Object.assign(state, slice);
  return { getState: () => state, slice };
};

describe('bitbucket-pr slice', () => {
  beforeEach(() => {
    pullRequestForBranchSpy.mockReset();
    getPullRequestSpy.mockReset();
    remoteUrlSpy.mockClear();
  });

  it('resolves the session branch to its pull request and records the repo', async () => {
    pullRequestForBranchSpy.mockResolvedValue(buildPr(7));
    const store = buildStore();

    await store.slice.refreshSessionBitbucketPr(SESSION_ID);

    expect(pullRequestForBranchSpy).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      workspaceSlug: 'acme',
      repoSlug: 'rocket',
      email: 'dev@acme.test',
      sourceBranch: 'ak/feat-thing',
    });
    const state = store.getState();
    expect(
      (state.sessionBitbucketPr as Record<string, { pr: BitbucketPullRequest | null }>)[SESSION_ID]
        ?.pr?.id,
    ).toBe(7);
    expect(
      (state.sessionBitbucketRepo as Record<string, { repoSlug: string }>)[SESSION_ID]?.repoSlug,
    ).toBe('rocket');
  });

  it('records the failure instead of clearing the pull request already on screen', async () => {
    pullRequestForBranchSpy.mockResolvedValueOnce(buildPr(7));
    const store = buildStore();
    await store.slice.refreshSessionBitbucketPr(SESSION_ID);

    pullRequestForBranchSpy.mockRejectedValueOnce(new Error('bitbucket is down'));
    await store.slice.refreshSessionBitbucketPr(SESSION_ID, { force: true });

    const entry = (
      store.getState().sessionBitbucketPr as Record<
        string,
        { pr: BitbucketPullRequest | null; error: string | null; loading: boolean }
      >
    )[SESSION_ID];
    expect(entry?.error).toContain('bitbucket is down');
    expect(entry?.pr?.id).toBe(7);
    expect(entry?.loading).toBe(false);
  });

  it('selecting a pull request fetches that one by id instead of the branch one', async () => {
    getPullRequestSpy.mockResolvedValue(buildPr(12));
    const store = buildStore();

    await store.slice.selectSessionBitbucketPr(SESSION_ID, 12);

    expect(pullRequestForBranchSpy).not.toHaveBeenCalled();
    expect(getPullRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequestId: 12, repoSlug: 'rocket' }),
    );
    expect(
      (store.getState().sessionBitbucketPr as Record<string, { pr: BitbucketPullRequest | null }>)[
        SESSION_ID
      ]?.pr?.id,
    ).toBe(12);
  });

  it('does nothing when the workspace has no bitbucket integration', async () => {
    const store = buildStore();
    Object.assign(store.getState(), { workspaceIntegrations: {} });

    await store.slice.refreshSessionBitbucketPr(SESSION_ID);

    expect(pullRequestForBranchSpy).not.toHaveBeenCalled();
    expect(store.getState().sessionBitbucketPr).toEqual({});
  });
});
