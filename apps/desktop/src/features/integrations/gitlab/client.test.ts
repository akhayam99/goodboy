// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import {
  gitlabFetchIssue,
  gitlabGetMr,
  gitlabListIssueDiscussions,
  gitlabMergeMr,
  gitlabMrCommits,
  gitlabMrPipelineJobs,
  gitlabProjectMergeMethods,
  gitlabReplyToIssueDiscussion,
  gitlabResolveMrDiscussion,
  gitlabSearchProjectUsers,
  gitlabUpdateIssueDescription,
  gitlabUpdateMr,
  issueIdentifier,
  type GitlabIssue,
  type GitlabMrDiscussion,
} from './client';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const mockInvoke = vi.mocked(invoke);

afterEach(() => {
  mockInvoke.mockReset();
});

function makeIssue(overrides: Partial<GitlabIssue> = {}): GitlabIssue {
  return {
    id: 101,
    iid: 7,
    projectId: 3,
    title: 'Fix the thing',
    description: null,
    state: 'opened',
    webUrl: 'https://gitlab.com/acme/web/-/issues/7',
    references: { full: 'acme/web#7' },
    updatedAt: '2026-05-21T10:00:00Z',
    milestone: null,
    labels: [],
    ...overrides,
  };
}

describe('issueIdentifier', () => {
  it('returns the full namespaced reference', () => {
    expect(issueIdentifier(makeIssue())).toBe('acme/web#7');
    expect(issueIdentifier(makeIssue({ references: { full: 'group/sub/proj#42' } }))).toBe(
      'group/sub/proj#42',
    );
  });

  it('falls back to #iid when the full reference is nullish', () => {
    const issue = makeIssue();
    (issue as { references: { full: string | null } }).references.full = null;
    expect(issueIdentifier(issue)).toBe('#7');
  });
});

describe('gitlabFetchIssue', () => {
  it('forwards the project path and issue iid to the fetch command', async () => {
    const issue = makeIssue();
    mockInvoke.mockResolvedValueOnce(issue);

    const result = await gitlabFetchIssue(
      'workspace-1' as WorkspaceId,
      'https://gitlab.com',
      'acme/web',
      7,
    );

    expect(result).toEqual(issue);
    expect(mockInvoke).toHaveBeenCalledWith('gitlab_fetch_issue', {
      workspaceId: 'workspace-1',
      host: 'https://gitlab.com',
      projectPath: 'acme/web',
      issueIid: 7,
    });
  });
});

describe('gitlabUpdateIssueDescription', () => {
  it('sends the new description to the update command and returns the saved body', async () => {
    mockInvoke.mockResolvedValueOnce('Saved by GitLab');

    const saved = await gitlabUpdateIssueDescription({
      workspaceId: 'workspace-1' as WorkspaceId,
      host: 'https://gitlab.com',
      projectPath: 'acme/web',
      issueIid: 7,
      description: 'Rewritten body',
    });

    expect(saved).toBe('Saved by GitLab');
    expect(mockInvoke).toHaveBeenCalledWith('gitlab_update_issue', {
      workspaceId: 'workspace-1',
      host: 'https://gitlab.com',
      projectPath: 'acme/web',
      issueIid: 7,
      description: 'Rewritten body',
    });
  });
});

describe('gitlabResolveMrDiscussion', () => {
  it('invokes the registered resolve command with the discussion id and the flag', async () => {
    const updated: GitlabMrDiscussion = {
      id: '6a9c1750b37d',
      individualNote: false,
      notes: [],
    };
    mockInvoke.mockResolvedValueOnce(updated);

    const result = await gitlabResolveMrDiscussion({
      workspaceId: 'workspace-1' as WorkspaceId,
      host: 'https://gitlab.com',
      projectPath: 'group/sub/repo',
      mrIid: 11,
      discussionId: '6a9c1750b37d',
      resolved: true,
    });

    expect(result).toBe(updated);
    expect(mockInvoke).toHaveBeenCalledWith('gitlab_resolve_mr_discussion', {
      workspaceId: 'workspace-1',
      host: 'https://gitlab.com',
      projectPath: 'group/sub/repo',
      mrIid: 11,
      discussionId: '6a9c1750b37d',
      resolved: true,
    });
  });

  it('carries a false flag when a thread is reopened', async () => {
    mockInvoke.mockResolvedValueOnce({ id: 'd-1', individualNote: false, notes: [] });

    await gitlabResolveMrDiscussion({
      workspaceId: 'workspace-1' as WorkspaceId,
      host: 'https://gitlab.example.com',
      projectPath: 'acme/web',
      mrIid: 4,
      discussionId: 'd-1',
      resolved: false,
    });

    expect(mockInvoke.mock.calls[0]?.[1]).toMatchObject({ resolved: false });
  });
});

describe('gitlab issue discussions', () => {
  it('lists the threads of an issue', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    await gitlabListIssueDiscussions({
      workspaceId: 'workspace-1' as WorkspaceId,
      host: 'https://gitlab.com',
      projectPath: 'acme/web',
      issueIid: 7,
    });

    expect(mockInvoke).toHaveBeenCalledWith('gitlab_list_issue_discussions', {
      workspaceId: 'workspace-1',
      host: 'https://gitlab.com',
      projectPath: 'acme/web',
      issueIid: 7,
    });
  });

  it('replies inside the chosen thread', async () => {
    mockInvoke.mockResolvedValueOnce(12);

    const noteId = await gitlabReplyToIssueDiscussion({
      workspaceId: 'workspace-1' as WorkspaceId,
      host: 'https://gitlab.com',
      projectPath: 'acme/web',
      issueIid: 7,
      discussionId: 'd-1',
      body: 'Agreed',
    });

    expect(noteId).toBe(12);
    expect(mockInvoke).toHaveBeenCalledWith('gitlab_reply_to_issue_discussion', {
      workspaceId: 'workspace-1',
      host: 'https://gitlab.com',
      projectPath: 'acme/web',
      issueIid: 7,
      discussionId: 'd-1',
      body: 'Agreed',
    });
  });
});

const MR_TARGET = {
  workspaceId: 'ws-1' as WorkspaceId,
  host: 'https://gitlab.com',
  projectPath: 'harborline/payments-api',
  mrIid: 42,
};

const PROJECT_TARGET = {
  workspaceId: 'ws-1' as WorkspaceId,
  host: 'https://gitlab.com',
  projectPath: 'harborline/payments-api',
};

describe('gitlabMergeMr', () => {
  it('sends no method when none is chosen, as the companion does', async () => {
    mockInvoke.mockResolvedValueOnce({});
    await gitlabMergeMr('ws-1' as WorkspaceId, 'https://gitlab.com', 'harborline/payments-api', 42);
    expect(mockInvoke).toHaveBeenCalledWith('gitlab_merge_mr', {
      workspaceId: 'ws-1',
      host: 'https://gitlab.com',
      projectPath: 'harborline/payments-api',
      mrIid: 42,
    });
  });

  it('sends the method and the project binding when given', async () => {
    mockInvoke.mockResolvedValueOnce({});
    await gitlabMergeMr(
      'ws-1' as WorkspaceId,
      'https://gitlab.com',
      'harborline/payments-api',
      42,
      'project-1' as ProjectId,
      'squash',
    );
    expect(mockInvoke).toHaveBeenCalledWith('gitlab_merge_mr', {
      workspaceId: 'ws-1',
      projectId: 'project-1',
      host: 'https://gitlab.com',
      projectPath: 'harborline/payments-api',
      mrIid: 42,
      method: 'squash',
    });
  });
});

describe('gitlab merge request calls', () => {
  it('reads one merge request by its number', async () => {
    mockInvoke.mockResolvedValueOnce({ iid: 42 });
    await gitlabGetMr(MR_TARGET);
    expect(mockInvoke).toHaveBeenCalledWith('gitlab_get_mr', MR_TARGET);
  });

  it('updates only what is supplied and keeps an empty reviewer list', async () => {
    mockInvoke.mockResolvedValue({ iid: 42 });
    await gitlabUpdateMr({ ...MR_TARGET, description: 'New body' });
    expect(mockInvoke).toHaveBeenLastCalledWith('gitlab_update_mr', {
      ...MR_TARGET,
      description: 'New body',
    });
    await gitlabUpdateMr({ ...MR_TARGET, title: 'New title', reviewerIds: [] });
    expect(mockInvoke).toHaveBeenLastCalledWith('gitlab_update_mr', {
      ...MR_TARGET,
      title: 'New title',
      reviewerIds: [],
    });
  });

  it('carries the project binding only when there is one', async () => {
    mockInvoke.mockResolvedValue({ iid: 42 });
    await gitlabUpdateMr({ ...MR_TARGET, projectId: 'project-1' as ProjectId, title: 'T' });
    expect(mockInvoke).toHaveBeenLastCalledWith('gitlab_update_mr', {
      ...MR_TARGET,
      projectId: 'project-1',
      title: 'T',
    });
    await gitlabGetMr({ ...MR_TARGET, projectId: undefined });
    expect(mockInvoke).toHaveBeenLastCalledWith('gitlab_get_mr', MR_TARGET);
  });

  it('reads the pipeline jobs and the commits of a merge request', async () => {
    mockInvoke.mockResolvedValueOnce({ pipeline: null, jobs: [] });
    expect(await gitlabMrPipelineJobs(MR_TARGET)).toEqual({ pipeline: null, jobs: [] });
    expect(mockInvoke).toHaveBeenLastCalledWith('gitlab_mr_pipeline_jobs', MR_TARGET);
    mockInvoke.mockResolvedValueOnce(null);
    expect(await gitlabMrPipelineJobs(MR_TARGET)).toBeNull();
    mockInvoke.mockResolvedValueOnce([]);
    await gitlabMrCommits(MR_TARGET);
    expect(mockInvoke).toHaveBeenLastCalledWith('gitlab_mr_commits', MR_TARGET);
  });
});

describe('gitlab project calls', () => {
  it('reads the merge rules of the project', async () => {
    mockInvoke.mockResolvedValueOnce({ mergeMethod: 'merge' });
    await gitlabProjectMergeMethods(PROJECT_TARGET);
    expect(mockInvoke).toHaveBeenCalledWith('gitlab_project_merge_methods', PROJECT_TARGET);
  });

  it('searches the users of the project', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await gitlabSearchProjectUsers({ ...PROJECT_TARGET, query: 'ken' });
    expect(mockInvoke).toHaveBeenCalledWith('gitlab_search_project_users', {
      ...PROJECT_TARGET,
      query: 'ken',
    });
  });
});
