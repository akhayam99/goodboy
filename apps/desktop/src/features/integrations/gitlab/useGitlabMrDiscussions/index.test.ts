import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import type { GitlabMrDiscussion } from '../client';

const h = vi.hoisted(() => ({
  list: vi.fn<() => Promise<ReadonlyArray<GitlabMrDiscussion>>>(),
  createNote: vi.fn(async () => 1),
  reply: vi.fn(async () => 2),
}));

vi.mock('../client', () => ({
  gitlabListMrDiscussions: h.list,
  gitlabCreateMrNote: h.createNote,
  gitlabReplyToMrDiscussion: h.reply,
}));

import { useGitlabMrDiscussions } from './index';

const TARGET = {
  workspaceId: 'workspace-1' as WorkspaceId,
  host: 'https://gitlab.com',
  projectPath: 'acme/web',
  mrIid: 4,
};

const discussion: GitlabMrDiscussion = {
  id: 'disc-1',
  individualNote: false,
  notes: [],
};

beforeEach(() => {
  h.list.mockReset();
  h.list.mockResolvedValue([discussion]);
  h.createNote.mockClear();
  h.reply.mockClear();
});

afterEach(cleanup);

describe('useGitlabMrDiscussions', () => {
  it('loads the discussions for a complete target', async () => {
    const { result } = renderHook(() => useGitlabMrDiscussions(TARGET));

    await waitFor(() => expect(result.current.discussions).toHaveLength(1));
    expect(h.list).toHaveBeenCalledWith(TARGET);
    expect(result.current.error).toBeNull();
  });

  it('stays idle and offers no actions without a target', async () => {
    const { result } = renderHook(() => useGitlabMrDiscussions({ ...TARGET, projectPath: null }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(h.list).not.toHaveBeenCalled();
    expect(result.current.post).toBeNull();
    expect(result.current.reply).toBeNull();
  });

  it('surfaces a load failure', async () => {
    h.list.mockRejectedValue(new Error('GitLab token expired'));
    const { result } = renderHook(() => useGitlabMrDiscussions(TARGET));

    await waitFor(() => expect(result.current.error).toBe('GitLab token expired'));
  });

  it('reloads after posting a note', async () => {
    const { result } = renderHook(() => useGitlabMrDiscussions(TARGET));
    await waitFor(() => expect(h.list).toHaveBeenCalledOnce());

    await result.current.post?.({ body: 'looks good' });

    expect(h.createNote).toHaveBeenCalledWith(
      TARGET.workspaceId,
      TARGET.host,
      TARGET.projectPath,
      TARGET.mrIid,
      'looks good',
    );
    await waitFor(() => expect(h.list).toHaveBeenCalledTimes(2));
  });

  it('reloads after replying in a thread', async () => {
    const { result } = renderHook(() => useGitlabMrDiscussions(TARGET));
    await waitFor(() => expect(h.list).toHaveBeenCalledOnce());

    await result.current.reply?.({ discussionId: 'disc-1', body: 'fixed' });

    expect(h.reply).toHaveBeenCalledWith({ ...TARGET, discussionId: 'disc-1', body: 'fixed' });
    await waitFor(() => expect(h.list).toHaveBeenCalledTimes(2));
  });
});
