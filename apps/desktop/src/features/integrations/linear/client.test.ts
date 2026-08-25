import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import {
  issuePullRequests,
  linearCreateComment,
  linearFetchIssue,
  linearFetchIssueComments,
  linearUpdateIssueDescription,
  type LinearAttachment,
  type LinearIssue,
} from './client';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const mockInvoke = vi.mocked(invoke);

function makeIssue(attachments: LinearAttachment[] | undefined): LinearIssue {
  return {
    id: 'lin-1',
    identifier: 'SER-1',
    title: 'Issue one',
    description: null,
    url: 'https://linear.app/demo-team/issue/SER-1',
    state: { name: 'In Progress', type: 'started' },
    team: { key: 'SER' },
    priority: 2,
    priorityLabel: 'High',
    assignee: { name: 'Ada' },
    project: { name: 'Desktop' },
    labels: { nodes: [{ name: 'Bug', color: '#ff0000' }] },
    updatedAt: '2026-05-21T10:00:00Z',
    ...(attachments ? { attachments: { nodes: attachments } } : {}),
  };
}

afterEach(() => {
  mockInvoke.mockReset();
});

function attachment(overrides: Partial<LinearAttachment>): LinearAttachment {
  return {
    id: 'att-1',
    title: null,
    url: 'https://example.com',
    sourceType: null,
    metadata: null,
    ...overrides,
  };
}

describe('issuePullRequests', () => {
  it('returns empty when there are no attachments', () => {
    expect(issuePullRequests(makeIssue(undefined))).toEqual([]);
    expect(issuePullRequests(makeIssue([]))).toEqual([]);
  });

  it('extracts github and gitlab PRs and ignores non-PR attachments', () => {
    const prs = issuePullRequests(
      makeIssue([
        attachment({ id: 'a', url: 'https://github.com/acme/web/pull/42' }),
        attachment({ id: 'b', url: 'https://gitlab.com/acme/web/-/merge_requests/7' }),
        attachment({ id: 'c', url: 'https://figma.com/file/abc' }),
      ]),
    );
    expect(prs.map((p) => p.number)).toEqual([42, 7]);
  });

  it('parses owner/repo for github PRs and leaves non-github repo null', () => {
    const prs = issuePullRequests(
      makeIssue([
        attachment({ id: 'a', url: 'https://github.com/acme/web/pull/42' }),
        attachment({ id: 'b', url: 'https://gitlab.com/acme/web/-/merge_requests/7' }),
      ]),
    );
    expect(prs.find((p) => p.number === 42)?.repo).toBe('acme/web');
    expect(prs.find((p) => p.number === 7)?.repo).toBeNull();
  });

  it('de-dupes by PR number', () => {
    const prs = issuePullRequests(
      makeIssue([
        attachment({ id: 'a', url: 'https://github.com/acme/web/pull/42' }),
        attachment({ id: 'b', url: 'https://github.com/acme/web/pull/42/files' }),
      ]),
    );
    expect(prs).toHaveLength(1);
    expect(prs[0]?.number).toBe(42);
  });

  it('reads status from metadata when it is a string, else null', () => {
    const [withStatus] = issuePullRequests(
      makeIssue([
        attachment({ url: 'https://github.com/acme/web/pull/1', metadata: { status: 'merged' } }),
      ]),
    );
    expect(withStatus?.status).toBe('merged');

    const [noStatus] = issuePullRequests(
      makeIssue([attachment({ url: 'https://github.com/acme/web/pull/2', metadata: { foo: 1 } })]),
    );
    expect(noStatus?.status).toBeNull();
  });
});

describe('Linear issue requests', () => {
  it('forwards issue ids to detail and comments commands', async () => {
    mockInvoke.mockResolvedValueOnce(makeIssue([])).mockResolvedValueOnce([]);

    await linearFetchIssue({ workspaceId: WORKSPACE_ID, issueId: 'issue-42' });
    await linearFetchIssueComments({ workspaceId: WORKSPACE_ID, issueId: 'issue-42' });

    expect(mockInvoke.mock.calls).toEqual([
      ['linear_fetch_issue', { workspaceId: WORKSPACE_ID, issueId: 'issue-42' }],
      ['linear_fetch_issue_comments', { workspaceId: WORKSPACE_ID, issueId: 'issue-42' }],
    ]);
  });

  it('carries the project scope only when the caller knows one', async () => {
    mockInvoke.mockResolvedValueOnce(makeIssue([])).mockResolvedValueOnce(makeIssue([]));

    await linearFetchIssue({
      workspaceId: WORKSPACE_ID,
      issueId: 'issue-42',
      projectId: 'project-9' as ProjectId,
    });
    await linearFetchIssue({ workspaceId: WORKSPACE_ID, issueId: 'issue-42' });

    expect(mockInvoke.mock.calls).toEqual([
      [
        'linear_fetch_issue',
        { workspaceId: WORKSPACE_ID, issueId: 'issue-42', projectId: 'project-9' },
      ],
      ['linear_fetch_issue', { workspaceId: WORKSPACE_ID, issueId: 'issue-42' }],
    ]);
  });

  it('posts a comment against the issue and returns the comment Linear created', async () => {
    const created = {
      id: 'comment-7',
      body: 'Looks good',
      createdAt: '2026-08-05T09:00:00Z',
      user: { name: 'Ada' },
    };
    mockInvoke.mockResolvedValueOnce(created);

    const comment = await linearCreateComment({
      workspaceId: WORKSPACE_ID,
      issueId: 'issue-42',
      body: 'Looks good',
    });

    expect(mockInvoke).toHaveBeenCalledWith('linear_create_comment', {
      workspaceId: WORKSPACE_ID,
      issueId: 'issue-42',
      body: 'Looks good',
    });
    expect(comment).toEqual(created);
  });

  it('sends the new description to the update command and returns the saved body', async () => {
    mockInvoke.mockResolvedValueOnce('Saved by Linear');

    const saved = await linearUpdateIssueDescription({
      workspaceId: WORKSPACE_ID,
      issueId: 'issue-42',
      description: 'Rewritten body',
    });

    expect(saved).toBe('Saved by Linear');
    expect(mockInvoke).toHaveBeenCalledWith('linear_update_issue', {
      workspaceId: WORKSPACE_ID,
      issueId: 'issue-42',
      description: 'Rewritten body',
    });
  });
});
