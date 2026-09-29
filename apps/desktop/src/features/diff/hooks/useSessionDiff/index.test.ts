// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  diff: vi.fn(),
  status: vi.fn(),
  commits: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (state: Record<string, unknown>) => T) => selector(h.state),
  useSummarizerStatus: () => ({ status: 'idle' }),
}));

vi.mock('../../../worktree/worktree', () => ({
  listBranchCommits: h.commits,
  worktreeDiff: h.diff,
  worktreeDiffCommit: vi.fn(),
  worktreeDiffWorking: vi.fn(),
  worktreeStatus: h.status,
}));

import { useSessionDiff } from '.';

const SESSION_ID = 'session-diff' as SessionId;
const WORKTREE = '/repo/ledger-core';

const stateWith = ({
  mountBase,
  projectBase,
}: {
  readonly mountBase: string | null;
  readonly projectBase: string | null;
}) => ({
  projects: [{ id: 'project-ledger', baseBranch: projectBase }],
  sessionProjectMounts: {
    [SESSION_ID]: [{ projectId: 'project-ledger', worktreePath: WORKTREE, baseBranch: mountBase }],
  },
  loadDiffComments: vi.fn(),
});

beforeEach(() => {
  h.diff.mockReset().mockResolvedValue('');
  h.status.mockReset().mockResolvedValue({ head: 'abc', mainDistance: { ahead: 0, behind: 0 } });
  h.commits.mockReset().mockResolvedValue([]);
});

describe('useSessionDiff base branch', () => {
  it('sends the base the user picked to the diff and to the status', async () => {
    h.state = stateWith({ mountBase: null, projectBase: 'develop' });

    renderHook(() => useSessionDiff({ sessionId: SESSION_ID, worktreePath: WORKTREE }));

    await waitFor(() => expect(h.diff).toHaveBeenCalled());
    await waitFor(() => expect(h.status).toHaveBeenCalled());
    expect(h.diff).toHaveBeenCalledWith({ worktreePath: WORKTREE, baseBranch: 'develop' });
    expect(h.status).toHaveBeenCalledWith({ worktreePath: WORKTREE, baseBranch: 'develop' });
  });

  it('prefers the base recorded on the mount', async () => {
    h.state = stateWith({ mountBase: 'release/9', projectBase: 'develop' });

    renderHook(() => useSessionDiff({ sessionId: SESSION_ID, worktreePath: WORKTREE }));

    await waitFor(() => expect(h.diff).toHaveBeenCalled());
    expect(h.diff).toHaveBeenCalledWith({ worktreePath: WORKTREE, baseBranch: 'release/9' });
  });

  it('keeps the backend default when the session has no explicit base', async () => {
    h.state = stateWith({ mountBase: null, projectBase: null });

    renderHook(() => useSessionDiff({ sessionId: SESSION_ID, worktreePath: WORKTREE }));

    await waitFor(() => expect(h.diff).toHaveBeenCalled());
    await waitFor(() => expect(h.status).toHaveBeenCalled());
    expect(h.diff).toHaveBeenCalledWith({ worktreePath: WORKTREE, baseBranch: null });
    expect(h.status).toHaveBeenCalledWith({ worktreePath: WORKTREE, baseBranch: null });
  });
});
