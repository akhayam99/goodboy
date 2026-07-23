import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepoPullRequest } from '@goodboy/core';
import type {
  GitlabWorkspaceIntegration,
  IsoDateTime,
  Workspace,
  WorkspaceId,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import type { AppStore } from '../../store';
import type { SetFn } from './types';
import { createReviewPrsSlice, selectReviewPrs } from './index';

const { detectRepoSlugSpy, listOpenPrsForRepoSpy, gitlabFetchProjectMrsSpy } = vi.hoisted(() => ({
  detectRepoSlugSpy: vi.fn(),
  listOpenPrsForRepoSpy: vi.fn(),
  gitlabFetchProjectMrsSpy: vi.fn(),
}));

vi.mock('@goodboy/core', () => ({
  detectRepoSlug: detectRepoSlugSpy,
  listOpenPrsForRepo: listOpenPrsForRepoSpy,
}));

vi.mock('../../../features/github/github', () => ({
  tauriGhRunner: { run: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })) },
}));

vi.mock('../../../features/integrations/gitlab/client', () => ({
  gitlabFetchProjectMrs: gitlabFetchProjectMrsSpy,
}));

vi.mock('../../../features/worktree/worktree', () => ({
  worktreeRemoteUrl: vi.fn(async () => 'git@gitlab.com:acme/web.git'),
}));

const WS_ID = 'workspace-1' as WorkspaceId;
const NOW = '2026-07-23T00:00:00.000Z' as IsoDateTime;

const buildWorkspace = (): Workspace => {
  return {
    id: WS_ID,
    name: 'ws',
    rootPath: '/tmp/repo',
    createdAt: NOW,
    updatedAt: NOW,
    lastAccessedAt: NOW,
  };
};

const buildGitlabIntegration = (): GitlabWorkspaceIntegration => {
  return {
    id: 'wi-1' as WorkspaceIntegrationId,
    workspaceId: WS_ID,
    provider: 'gitlab',
    credentialKey: 'k',
    config: { userName: 'nbro', userId: '1', host: 'https://gitlab.com' },
    createdAt: NOW,
    updatedAt: NOW,
  };
};

const buildRepoPr = (overrides: Partial<RepoPullRequest>): RepoPullRequest => {
  return {
    number: 1,
    title: 'PR',
    url: 'https://github.com/org/repo/pull/1',
    state: 'open',
    mergeable: true,
    checks: null,
    baseBranch: 'main',
    headBranch: 'feature',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-01-01T00:00:00Z',
    mergeQueue: null,
    author: 'alice',
    reviewRequestLogins: [],
    ...overrides,
  };
};

const buildMr = (overrides: Partial<GitlabMergeRequest>): GitlabMergeRequest => {
  return {
    id: 1,
    iid: 10,
    projectId: 3,
    title: 'MR',
    description: null,
    state: 'opened',
    webUrl: 'https://gitlab.com/acme/web/-/merge_requests/10',
    sourceBranch: 'feat-x',
    targetBranch: 'main',
    draft: false,
    hasConflicts: false,
    mergeStatus: null,
    updatedAt: '2026-01-02T00:00:00Z',
    author: { username: 'other', name: 'Other', avatarUrl: null },
    reviewers: null,
    ...overrides,
  };
};

type Harness = {
  slice: ReturnType<typeof createReviewPrsSlice>;
  getState: () => AppStore;
};

const buildHarness = (initial: Record<string, unknown>): Harness => {
  let state = {
    reviewPrs: {},
    workspaces: [buildWorkspace()],
    workspaceIntegrations: {},
    githubStatus: null,
    ...initial,
  } as unknown as AppStore;
  const get = () => state;
  const set: SetFn = (p) => {
    const patch = typeof p === 'function' ? p(state) : p;
    state = { ...state, ...patch };
  };
  return { slice: createReviewPrsSlice(set, get), getState: get };
};

describe('review-prs slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detectRepoSlugSpy.mockResolvedValue(null);
    listOpenPrsForRepoSpy.mockResolvedValue([]);
    gitlabFetchProjectMrsSpy.mockResolvedValue([]);
  });

  it('classifies github PRs as mine or review-requested case-insensitively', async () => {
    detectRepoSlugSpy.mockResolvedValue('org/repo');
    listOpenPrsForRepoSpy.mockResolvedValue([
      buildRepoPr({ number: 1, author: 'me' }),
      buildRepoPr({ number: 2, author: 'other', reviewRequestLogins: ['ME'] }),
    ]);
    const { slice, getState } = buildHarness({
      githubStatus: { available: true, mode: 'gh-cli', user: 'Me' },
    });
    await slice.refreshReviewPrs(WS_ID);
    const result = selectReviewPrs(WS_ID)(getState());
    const mine = result.items.find((p) => p.number === 1);
    const other = result.items.find((p) => p.number === 2);
    expect(mine?.mine).toBe(true);
    expect(mine?.repo).toBe('org/repo');
    expect(other?.mine).toBe(false);
    expect(other?.reviewRequested).toBe(true);
    expect(other?.authorAvatarUrl).toBe('https://github.com/other.png');
  });

  it('maps gitlab MR states and classifies by integration userName', async () => {
    gitlabFetchProjectMrsSpy.mockResolvedValue([
      buildMr({ iid: 1, state: 'opened', draft: true }),
      buildMr({
        iid: 2,
        state: 'opened',
        author: { username: 'nbro', name: 'N', avatarUrl: 'https://gitlab.com/n.png' },
      }),
      buildMr({ iid: 3, state: 'merged' }),
      buildMr({ iid: 4, state: 'closed', reviewers: [{ username: 'nbro', name: 'N', avatarUrl: null }] }),
    ]);
    const { slice, getState } = buildHarness({
      workspaceIntegrations: { [WS_ID]: [buildGitlabIntegration()] },
    });
    await slice.refreshReviewPrs(WS_ID);
    const result = selectReviewPrs(WS_ID)(getState());
    const byIid = new Map(result.items.map((p) => [p.number, p]));
    expect(result.items.map((p) => p.state).sort()).toEqual(
      ['closed', 'draft', 'merged', 'open'].sort(),
    );
    expect(byIid.get(2)?.mine).toBe(true);
    expect(byIid.get(2)?.repo).toBe('acme/web');
    expect(byIid.get(2)?.authorAvatarUrl).toBe('https://gitlab.com/n.png');
    expect(byIid.get(1)?.mine).toBe(false);
    expect(byIid.get(4)?.reviewRequested).toBe(true);
  });

  it('keeps github results when the gitlab provider fails', async () => {
    detectRepoSlugSpy.mockResolvedValue('org/repo');
    listOpenPrsForRepoSpy.mockResolvedValue([buildRepoPr({ number: 7 })]);
    gitlabFetchProjectMrsSpy.mockRejectedValue(new Error('gitlab down'));
    const { slice, getState } = buildHarness({
      githubStatus: { available: true, mode: 'gh-cli', user: 'me' },
      workspaceIntegrations: { [WS_ID]: [buildGitlabIntegration()] },
    });
    await slice.refreshReviewPrs(WS_ID);
    const result = selectReviewPrs(WS_ID)(getState());
    expect(result.items.map((p) => p.id)).toEqual(['github:7']);
    expect(result.error).toContain('gitlab down');
    expect(result.loading).toBe(false);
  });

  it('merges both providers sorted by updatedAt descending', async () => {
    detectRepoSlugSpy.mockResolvedValue('org/repo');
    listOpenPrsForRepoSpy.mockResolvedValue([
      buildRepoPr({ number: 1, updatedAt: '2026-01-01T00:00:00Z' }),
    ]);
    gitlabFetchProjectMrsSpy.mockResolvedValue([
      buildMr({ iid: 2, updatedAt: '2026-03-01T00:00:00Z' }),
    ]);
    const { slice, getState } = buildHarness({
      workspaceIntegrations: { [WS_ID]: [buildGitlabIntegration()] },
    });
    await slice.refreshReviewPrs(WS_ID);
    const result = selectReviewPrs(WS_ID)(getState());
    expect(result.items.map((p) => p.id)).toEqual(['gitlab:2', 'github:1']);
    expect(result.fetchedAt).not.toBeNull();
  });

  it('selectReviewPrs falls back to an empty idle state', () => {
    const { getState } = buildHarness({});
    const result = selectReviewPrs('missing-ws' as WorkspaceId)(getState());
    expect(result).toEqual({ items: [], loading: false, error: null, fetchedAt: null });
  });
});
