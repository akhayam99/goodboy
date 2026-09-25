import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import type { OverrideSettings } from '@goodboy/types';
import type { GitlabIssue, GitlabMrDiscussion } from '../client';
import { overridesWithAttribution } from '../../../../__tests__/helpers/attributionOverrides';

type StoreGitlabIntegration = { provider: string; config: { host: string } };

const h = vi.hoisted(() => ({
  list: vi.fn<() => Promise<ReadonlyArray<GitlabMrDiscussion>>>(),
  createNote: vi.fn(async () => 1),
  reply: vi.fn(async () => 2),
  store: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<StoreGitlabIntegration>>,
    workspaceOverrides: {} as Record<string, OverrideSettings>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

vi.mock('../client', () => ({
  gitlabListIssueDiscussions: h.list,
  gitlabCreateIssueNote: h.createNote,
  gitlabReplyToIssueDiscussion: h.reply,
}));

import { useGitlabIssueDiscussions } from './index';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const ISSUE: GitlabIssue = {
  id: 101,
  iid: 7,
  projectId: 3,
  title: 'Fix the thing',
  description: 'Investigate the flaky request.',
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/issues/7',
  references: { full: 'acme/web#7' },
  updatedAt: '2026-05-21T10:00:00Z',
  milestone: null,
  labels: [],
};

const TARGET = {
  workspaceId: WORKSPACE_ID,
  host: 'https://gitlab.com',
  projectPath: 'acme/web',
  issueIid: 7,
  projectId: undefined,
};

const discussion = ({ id }: { readonly id: string }): GitlabMrDiscussion => ({
  id,
  individualNote: true,
  notes: [
    {
      id: 1,
      body: `note ${id}`,
      system: false,
      author: { username: 'alice', name: 'Alice', avatarUrl: null },
      createdAt: '2026-07-22T10:00:00Z',
      resolvable: false,
      resolved: null,
      position: null,
    },
  ],
});

beforeEach(() => {
  h.list.mockReset();
  h.list.mockResolvedValue([discussion({ id: 'd-1' })]);
  h.createNote.mockClear();
  h.reply.mockClear();
  h.store.workspaceIntegrations = {
    [WORKSPACE_ID]: [{ provider: 'gitlab', config: { host: 'https://gitlab.com' } }],
  };
  h.store.workspaceOverrides = {};
});

afterEach(cleanup);

describe('useGitlabIssueDiscussions', () => {
  it('loads the threads for an issue backed by a connected workspace', async () => {
    const { result } = renderHook(() =>
      useGitlabIssueDiscussions({ issue: ISSUE, workspaceId: WORKSPACE_ID }),
    );

    await waitFor(() => expect(result.current.discussions).toHaveLength(1));
    expect(h.list).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      host: 'https://gitlab.com',
      projectPath: 'acme/web',
      issueIid: 7,
    });
  });

  it('stays idle and offers no post path without an issue', async () => {
    const { result } = renderHook(() =>
      useGitlabIssueDiscussions({ issue: null, workspaceId: WORKSPACE_ID }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(h.list).not.toHaveBeenCalled();
    expect(result.current.post).toBeNull();
  });

  it('surfaces a load failure', async () => {
    h.list.mockRejectedValue(new Error('GitLab token expired'));
    const { result } = renderHook(() =>
      useGitlabIssueDiscussions({ issue: ISSUE, workspaceId: WORKSPACE_ID }),
    );

    await waitFor(() => expect(result.current.error).toBe('GitLab token expired'));
  });

  it('starts a new thread with a note and reloads', async () => {
    const { result } = renderHook(() =>
      useGitlabIssueDiscussions({ issue: ISSUE, workspaceId: WORKSPACE_ID }),
    );
    await waitFor(() => expect(h.list).toHaveBeenCalledOnce());

    await result.current.post?.({ body: 'looks good', discussionId: null });

    expect(h.createNote).toHaveBeenCalledWith({
      ...TARGET,
      body: `looks good\n\n*Written by Goodboy*`,
    });
    expect(h.reply).not.toHaveBeenCalled();
    await waitFor(() => expect(h.list).toHaveBeenCalledTimes(2));
  });

  it('replies inside the chosen thread', async () => {
    const { result } = renderHook(() =>
      useGitlabIssueDiscussions({ issue: ISSUE, workspaceId: WORKSPACE_ID }),
    );
    await waitFor(() => expect(h.list).toHaveBeenCalledOnce());

    await result.current.post?.({ body: 'agreed', discussionId: 'd-1' });

    expect(h.reply).toHaveBeenCalledWith({
      ...TARGET,
      discussionId: 'd-1',
      body: `agreed\n\n*Written by Goodboy*`,
    });
    expect(h.createNote).not.toHaveBeenCalled();
  });

  it('drops the attribution line when the workspace switched it off', async () => {
    h.store.workspaceOverrides = {
      [WORKSPACE_ID]: overridesWithAttribution({ attributionFooter: false }),
    };
    const { result } = renderHook(() =>
      useGitlabIssueDiscussions({ issue: ISSUE, workspaceId: WORKSPACE_ID }),
    );
    await waitFor(() => expect(h.list).toHaveBeenCalledOnce());

    await result.current.post?.({ body: 'looks good', discussionId: null });

    expect(h.createNote).toHaveBeenCalledWith({ ...TARGET, body: 'looks good' });
  });
});
