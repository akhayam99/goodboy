import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';
import { gitlabFetchIssue, humanizeMergeStatus, issueIdentifier, type GitlabIssue } from './client';

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
