// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GitlabMergeRequest, GitlabMrApprovalState } from './client';
import { mapMrToPullRequestState } from './mapMrToPullRequestState';

const MR: GitlabMergeRequest = {
  id: 4201,
  iid: 42,
  projectId: 9,
  title: 'Stop retried webhooks posting a second credit',
  description: 'Key the guard on the event id.',
  state: 'opened',
  webUrl: 'https://gitlab.com/harborline/payments-api/-/merge_requests/42',
  sourceBranch: 'hl/fix-duplicate-credit',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-10-06T09:30:00Z',
  sha: 'a41c9e2b7d3f',
};

const approvals = ({
  left,
  approvers,
}: {
  readonly left: number;
  readonly approvers: number;
}): GitlabMrApprovalState => ({
  approvalsRequired: 1,
  approvalsLeft: left,
  userHasApproved: false,
  userCanApprove: true,
  approvedBy: Array.from({ length: approvers }, (_, index) => ({
    user: { username: `reviewer-${index}`, name: `Reviewer ${index}`, avatarUrl: null },
  })),
});

describe('mapMrToPullRequestState', () => {
  it('maps nothing to nothing', () => {
    expect(mapMrToPullRequestState({ mr: null })).toBeNull();
  });

  it('carries the identity, the branches, the body and the head sha', () => {
    expect(mapMrToPullRequestState({ mr: MR })).toMatchObject({
      number: 42,
      title: 'Stop retried webhooks posting a second credit',
      url: MR.webUrl,
      state: 'open',
      baseBranch: 'main',
      headBranch: 'hl/fix-duplicate-credit',
      isDraft: false,
      body: 'Key the guard on the event id.',
      headSha: 'a41c9e2b7d3f',
      mergedAt: null,
    });
  });

  it('drops the draft prefix from the title and keeps the draft flag', () => {
    expect(
      mapMrToPullRequestState({
        mr: { ...MR, draft: true, title: 'Draft: Stop retried webhooks' },
      }),
    ).toMatchObject({ title: 'Stop retried webhooks', isDraft: true, state: 'draft' });
  });

  it.each([
    ['opened', false, 'open'],
    ['merged', false, 'merged'],
    ['closed', false, 'closed'],
    ['locked', false, 'queued'],
    ['opened', true, 'draft'],
  ] as const)('reads state %s with draft %s as %s', (state, draft, kind) => {
    expect(mapMrToPullRequestState({ mr: { ...MR, state, draft } })?.state).toBe(kind);
  });

  it.each([
    [{ hasConflicts: true, mergeStatus: 'can_be_merged' as const }, false],
    [{ hasConflicts: false, mergeStatus: 'checking' as const }, null],
    [{ hasConflicts: false, mergeStatus: 'unchecked' as const }, null],
    [{ hasConflicts: false, mergeStatus: 'can_be_merged' as const }, true],
    [{ hasConflicts: false, mergeStatus: null }, true],
  ])('reads %j as mergeable %s', (patch, mergeable) => {
    expect(mapMrToPullRequestState({ mr: { ...MR, ...patch } })?.mergeable).toBe(mergeable);
  });

  it.each([
    [undefined, null],
    [null, null],
    [approvals({ left: 1, approvers: 0 }), 'review_required'],
    [approvals({ left: 1, approvers: 1 }), 'review_required'],
    [approvals({ left: 0, approvers: 0 }), 'review_required'],
    [approvals({ left: 0, approvers: 1 }), 'approved'],
  ] as const)('reads the approvals %j as the decision %s', (state, decision) => {
    expect(mapMrToPullRequestState({ mr: MR, approvals: state })?.reviewDecision).toBe(decision);
  });

  it('never reads changes requested', () => {
    const decisions = [undefined, null, approvals({ left: 0, approvers: 2 })].map(
      (state) => mapMrToPullRequestState({ mr: MR, approvals: state })?.reviewDecision,
    );
    expect(decisions).not.toContain('changes_requested');
  });

  it.each([
    ['success', 'success'],
    ['failed', 'failure'],
    ['running', 'pending'],
    ['pending', 'pending'],
    ['created', 'pending'],
    ['canceled', null],
    ['skipped', null],
    ['manual', null],
    ['something-new', null],
  ] as const)('reads a %s head pipeline as checks %s', (status, checks) => {
    expect(
      mapMrToPullRequestState({ mr: { ...MR, headPipeline: { id: 1, status } } })?.checks,
    ).toBe(checks);
  });

  it('leaves checks null, never zero, when there is no pipeline', () => {
    expect(mapMrToPullRequestState({ mr: MR })?.checks).toBeNull();
    expect(mapMrToPullRequestState({ mr: { ...MR, headPipeline: null } })?.checks).toBeNull();
  });

  it('keeps the merge time of a merged request', () => {
    expect(
      mapMrToPullRequestState({
        mr: { ...MR, state: 'merged', mergedAt: '2026-10-06T10:00:00Z' },
      })?.mergedAt,
    ).toBe('2026-10-06T10:00:00Z');
  });
});
