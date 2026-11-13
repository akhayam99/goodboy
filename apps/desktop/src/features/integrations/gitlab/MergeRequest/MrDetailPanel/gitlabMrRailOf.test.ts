import { describe, expect, it } from 'vitest';
import type { GitlabMergeRequest, GitlabMrApprovalState } from '../../client';
import { gitlabMrRailOf } from './gitlabMrRailOf';

const user = (username: string) => ({ username, name: username, avatarUrl: null });

const mrOf = (overrides: Partial<GitlabMergeRequest>): GitlabMergeRequest => ({
  id: 1,
  iid: 4,
  projectId: 9,
  title: 'Raise the fuel constant',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/payments-api/-/merge_requests/4',
  sourceBranch: 'fuel',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-08-01T10:00:00Z',
  ...overrides,
});

const approvalOf = (names: ReadonlyArray<string>): GitlabMrApprovalState => ({
  approvalsRequired: 1,
  approvalsLeft: 0,
  userHasApproved: false,
  userCanApprove: true,
  approvedBy: names.map((name) => ({ user: user(name) })),
});

describe('gitlabMrRailOf', () => {
  it('marks a reviewer approved from the approval state and adds approvers nobody asked', () => {
    const rail = gitlabMrRailOf({
      mr: mrOf({ author: user('harbor-dev'), reviewers: [user('ana'), user('bo')] }),
      approval: approvalOf(['bo', 'cy']),
    });
    expect(rail.reviewers.map((entry) => [entry.person.login, entry.state])).toEqual([
      ['ana', 'pending'],
      ['bo', 'approved'],
      ['cy', 'approved'],
    ]);
    expect(rail.author?.login).toBe('harbor-dev');
  });

  it('turns the head pipeline into the checks line', () => {
    const rail = gitlabMrRailOf({
      mr: mrOf({ headPipeline: { id: 1, status: 'failed' } }),
      approval: null,
    });
    expect(rail.checks?.failing).toBe(1);
    expect(rail.checks?.failingNames).toEqual(['Pipeline']);
  });

  it('hides every row the host has no fact for', () => {
    const rail = gitlabMrRailOf({ mr: mrOf({}), approval: null });
    expect(rail.reviewers).toEqual([]);
    expect(rail.checks).toBeNull();
    expect(rail.author).toBeNull();
    expect(rail.linked).toEqual([]);
  });
});
