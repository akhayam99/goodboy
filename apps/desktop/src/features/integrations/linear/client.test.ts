import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';
import {
  issuePullRequests,
  linearFetchIssue,
  linearFetchIssueComments,
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
    url: 'https://linear.app/serenis/issue/SER-1',
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
});
