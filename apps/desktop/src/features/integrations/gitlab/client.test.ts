import { describe, expect, it } from 'vitest';
import { issueIdentifier, type GitlabIssue } from './client';

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
