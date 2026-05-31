import { describe, expect, it } from 'vitest';
import { issuePullRequests, type LinearAttachment, type LinearIssue } from './client';

function makeIssue(attachments: LinearAttachment[] | undefined): LinearIssue {
  return {
    id: 'lin-1',
    identifier: 'SER-1',
    title: 'Issue one',
    description: null,
    url: 'https://linear.app/serenis/issue/SER-1',
    state: { name: 'In Progress', type: 'started' },
    team: { key: 'SER' },
    updatedAt: '2026-05-21T10:00:00Z',
    ...(attachments ? { attachments: { nodes: attachments } } : {}),
  };
}

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
