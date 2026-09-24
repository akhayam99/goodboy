import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import type { GitlabMrDiscussion, GitlabMrNote } from '../../client';

const h = vi.hoisted(() => ({
  list: vi.fn<() => Promise<ReadonlyArray<GitlabMrDiscussion>>>(),
  createNote: vi.fn(async () => 1),
  reply: vi.fn(async () => 2),
  resolve: vi.fn<() => Promise<GitlabMrDiscussion>>(),
}));

vi.mock('../../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../client')>();
  return {
    ...actual,
    gitlabListMrDiscussions: h.list,
    gitlabCreateMrNote: h.createNote,
    gitlabReplyToMrDiscussion: h.reply,
    gitlabResolveMrDiscussion: h.resolve,
  };
});

import { useGitlabMrDiscussions } from '../../useGitlabMrDiscussions';
import { MrConversation } from './MrConversation';

const TARGET = {
  workspaceId: 'workspace-1' as WorkspaceId,
  host: 'https://gitlab.com',
  projectPath: 'acme/web',
  mrIid: 4,
};

const NOTE: GitlabMrNote = {
  id: 1,
  body: 'one nit',
  system: false,
  author: { username: 'ada', name: 'Ada Lovelace', avatarUrl: null },
  createdAt: '2026-08-01T10:00:00Z',
  resolvable: true,
  resolved: false,
  position: null,
};

const DISCUSSION: GitlabMrDiscussion = {
  id: 'disc-1',
  individualNote: false,
  notes: [NOTE],
};

const Harness = () => {
  const discussions = useGitlabMrDiscussions(TARGET);
  return (
    <MrConversation
      discussions={discussions.discussions}
      isLoading={discussions.isLoading}
      error={discussions.error}
      onRetry={discussions.reload}
      onPost={null}
      onReply={null}
      onResolve={discussions.resolve}
      resolveError={discussions.resolveError}
    />
  );
};

beforeEach(() => {
  h.list.mockReset();
  h.list.mockResolvedValue([DISCUSSION]);
  h.resolve.mockReset();
});

afterEach(cleanup);

describe('MrConversation resolve wiring', () => {
  it('carries the click through to the client with the full merge request target', async () => {
    h.resolve.mockResolvedValue(DISCUSSION);
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resolve' })).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    });

    expect(h.resolve).toHaveBeenCalledWith({ ...TARGET, discussionId: 'disc-1', resolved: true });
  });

  it('reopens a resolved thread with the cleared flag', async () => {
    h.list.mockResolvedValue([{ ...DISCUSSION, notes: [{ ...NOTE, resolved: true }] }]);
    h.resolve.mockResolvedValue(DISCUSSION);
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unresolve' })).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unresolve' }));
    });

    expect(h.resolve).toHaveBeenCalledWith({ ...TARGET, discussionId: 'disc-1', resolved: false });
  });

  it('keeps a rejected resolve visible after the refetch has settled', async () => {
    h.resolve.mockRejectedValue(new Error('GitLab said 403'));
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resolve' })).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    });
    await waitFor(() => expect(h.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resolve' })).toBeDefined());

    expect(screen.getByRole('alert').textContent).toBe('GitLab said 403');
  });
});
