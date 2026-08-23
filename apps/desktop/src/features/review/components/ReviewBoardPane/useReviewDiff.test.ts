import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  IsoDateTime,
  Session,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../integrations/gitlab/client';
import {
  resolveReviewTarget,
  type ReviewTargetState,
} from '../../../../store/slices/review-drafts/resolveReviewTarget';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const NOW = '2026-08-01T00:00:00.000Z' as IsoDateTime;

const h = vi.hoisted(() => ({
  ghPrDiff: vi.fn(async () => ''),
  gitlabMrDiff: vi.fn(async () => ''),
}));

vi.mock('@goodboy/core', () => ({ parseUnifiedDiff: () => [] }));
vi.mock('../../../github/github', () => ({ ghPrDiff: h.ghPrDiff }));
vi.mock('../../../integrations/gitlab/client', () => ({ gitlabMrDiff: h.gitlabMrDiff }));
vi.mock('../../../../store/slices/worktrees/resolveSessionRepo', () => ({
  resolveSessionRepo: () => ({
    repoRoot: '/repo',
    worktreePath: '/repo',
    branch: 'ak/feature',
    mountName: null,
    workspaceId: WORKSPACE_ID,
  }),
}));

type MockStore = ReviewTargetState & {
  readonly workspaces: ReadonlyArray<{ readonly id: WorkspaceId; readonly rootPath: string }>;
  readonly workspaceIntegrations: Readonly<
    Record<string, ReadonlyArray<{ readonly provider: string; readonly config: { host: string } }>>
  >;
};

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (store: MockStore) => T) => selector(state),
}));

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Review the merge request',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const githubTask: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'github',
  externalId: '42',
  identifier: '#42',
  url: 'https://github.com/acme/web/pull/42',
  title: 'PR',
  createdAt: NOW,
};

const gitlabTask: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'gitlab',
  externalId: '10',
  identifier: '!10',
  url: 'https://gitlab.com/acme/web/-/merge_requests/10',
  title: 'MR',
  createdAt: NOW,
};

const mergeRequest: GitlabMergeRequest = {
  id: 100,
  iid: 10,
  projectId: 3,
  title: 'MR',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/merge_requests/10',
  sourceBranch: 'ak/feature',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: NOW,
};

const state: MockStore = {
  sessionExternalTasks: { [SESSION_ID]: [githubTask, gitlabTask] },
  sessions: [],
  projects: [],
  sessionProjectMounts: {},
  sessionActiveProject: {},
  sessionProjectPrs: { [SESSION_ID]: {} },
  sessionGitlabMr: {
    [SESSION_ID]: { mr: mergeRequest, fetchedAt: NOW, loading: false, error: null },
  },
  workspaces: [{ id: WORKSPACE_ID, rootPath: '/repo' }],
  workspaceIntegrations: {
    [WORKSPACE_ID]: [{ provider: 'gitlab', config: { host: 'https://gitlab.com' } }],
  },
};

import { useReviewDiff } from './useReviewDiff';

afterEach(() => {
  cleanup();
  h.ghPrDiff.mockClear();
  h.gitlabMrDiff.mockClear();
});

describe('useReviewDiff', () => {
  it('resolves the same target the review draft path stamps on every comment', async () => {
    const { result } = renderHook(() => useReviewDiff({ session }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.target).toEqual({
      provider: 'gitlab',
      repo: 'acme/web',
      prNumber: 10,
    });
    expect(result.current.target).toEqual(resolveReviewTarget({ state, sessionId: SESSION_ID }));
  });

  it('fetches the diff of the discovered merge request, not the priority-first candidate', async () => {
    renderHook(() => useReviewDiff({ session }));

    await waitFor(() => expect(h.gitlabMrDiff).toHaveBeenCalledOnce());

    expect(h.gitlabMrDiff).toHaveBeenCalledWith(WORKSPACE_ID, 'https://gitlab.com', 'acme/web', 10);
    expect(h.ghPrDiff).not.toHaveBeenCalled();
  });
});
