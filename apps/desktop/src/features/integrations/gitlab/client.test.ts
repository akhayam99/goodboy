import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';
import {
  gitlabFetchIssue,
  gitlabResolveMrDiscussion,
  gitlabUpdateIssueDescription,
  humanizeMergeStatus,
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

describe('humanizeMergeStatus', () => {
  it('maps a mergeable status to a success "Can merge" badge', () => {
    expect(humanizeMergeStatus('can_be_merged')).toEqual({ label: 'Can merge', tone: 'success' });
  });

  it('maps a blocked status to a danger "Blocked" badge', () => {
    expect(humanizeMergeStatus('cannot_be_merged')).toEqual({ label: 'Blocked', tone: 'danger' });
  });

  it('maps pending statuses to a muted "Checking" badge', () => {
    expect(humanizeMergeStatus('checking')).toEqual({ label: 'Checking', tone: 'muted' });
    expect(humanizeMergeStatus('unchecked')).toEqual({ label: 'Checking', tone: 'muted' });
    expect(humanizeMergeStatus('cannot_be_merged_recheck')).toEqual({
      label: 'Checking',
      tone: 'muted',
    });
  });

  it('returns null when the status is unknown', () => {
    expect(humanizeMergeStatus(null)).toBeNull();
  });
});
