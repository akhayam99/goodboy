import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import type { GitlabMrApprovalState } from '../client';

const h = vi.hoisted(() => ({
  read: vi.fn<() => Promise<GitlabMrApprovalState | null>>(),
  approve: vi.fn<() => Promise<GitlabMrApprovalState | null>>(),
  unapprove: vi.fn<() => Promise<GitlabMrApprovalState | null>>(),
}));

vi.mock('../client', () => ({
  gitlabMrApprovalState: h.read,
  gitlabApproveMr: h.approve,
  gitlabUnapproveMr: h.unapprove,
}));

import { useGitlabMrApprovals } from './index';

const TARGET = {
  workspaceId: 'workspace-1' as WorkspaceId,
  host: 'https://gitlab.com',
  projectPath: 'acme/web',
  mrIid: 4,
};

type StateParams = {
  readonly userHasApproved: boolean;
};

const state = ({ userHasApproved }: StateParams): GitlabMrApprovalState => ({
  approvalsRequired: 1,
  approvalsLeft: userHasApproved ? 0 : 1,
  userHasApproved,
  userCanApprove: !userHasApproved,
  approvedBy: userHasApproved ? [{ user: { username: 'ak', name: 'Amin', avatarUrl: null } }] : [],
});

beforeEach(() => {
  h.read.mockReset();
  h.read.mockResolvedValue(state({ userHasApproved: false }));
  h.approve.mockReset();
  h.approve.mockResolvedValue(state({ userHasApproved: true }));
  h.unapprove.mockReset();
  h.unapprove.mockResolvedValue(state({ userHasApproved: false }));
});

afterEach(cleanup);

describe('useGitlabMrApprovals', () => {
  it('loads the approval state', async () => {
    const { result } = renderHook(() => useGitlabMrApprovals(TARGET));

    await waitFor(() => expect(result.current.approval?.approvalsRequired).toBe(1));
    expect(result.current.isSupported).toBe(true);
  });

  it('marks approvals unsupported when the endpoint returns nothing', async () => {
    h.read.mockResolvedValue(null);
    const { result } = renderHook(() => useGitlabMrApprovals(TARGET));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSupported).toBe(false);
    expect(result.current.approval).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('swaps the state after approving, with no reload', async () => {
    const { result } = renderHook(() => useGitlabMrApprovals(TARGET));
    await waitFor(() => expect(result.current.approval).not.toBeNull());

    await act(async () => {
      await result.current.approve?.();
    });

    expect(result.current.approval?.userHasApproved).toBe(true);
    expect(h.read).toHaveBeenCalledOnce();
  });

  it('reports a failed vote without dropping the panel', async () => {
    h.approve.mockRejectedValue(new Error('403 forbidden'));
    const { result } = renderHook(() => useGitlabMrApprovals(TARGET));
    await waitFor(() => expect(result.current.approval).not.toBeNull());

    await act(async () => {
      await result.current.approve?.();
    });

    expect(result.current.error).toBe('403 forbidden');
    expect(result.current.approval?.userHasApproved).toBe(false);
  });
});
