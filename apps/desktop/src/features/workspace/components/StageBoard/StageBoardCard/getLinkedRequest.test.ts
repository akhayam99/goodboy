import { describe, expect, it } from 'vitest';
import type { GitlabMergeRequest } from '../../../../integrations/gitlab/client';
import { getLinkedRequest } from './getLinkedRequest';

const mergeRequest = (overrides: Partial<GitlabMergeRequest>): GitlabMergeRequest => ({
  id: 1,
  iid: 12,
  projectId: 1,
  title: 'Retry ledger sync',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.example.test/acme/ledger-core/-/merge_requests/12',
  sourceBranch: 'fix/retry',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-09-29T08:00:00Z',
  ...overrides,
});

describe('getLinkedRequest', () => {
  it('reads a closed draft merge request as closed, like every other surface', () => {
    const linked = getLinkedRequest({
      pullRequest: null,
      mergeRequest: mergeRequest({ state: 'closed', draft: true }),
    });

    expect(linked.state).toBe('closed');
    expect(linked.title).toBe('Merge request !12 · closed');
  });

  it('reads a locked merge request as in flight, not closed', () => {
    const linked = getLinkedRequest({
      pullRequest: null,
      mergeRequest: mergeRequest({ state: 'locked' }),
    });

    expect(linked.state).toBe('queued');
  });

  it('keeps an open draft as draft and an open merge request as open', () => {
    expect(
      getLinkedRequest({ pullRequest: null, mergeRequest: mergeRequest({ draft: true }) }).state,
    ).toBe('draft');
    expect(getLinkedRequest({ pullRequest: null, mergeRequest: mergeRequest({}) }).state).toBe(
      'open',
    );
  });

  it('returns none without a pull or merge request', () => {
    expect(getLinkedRequest({ pullRequest: null, mergeRequest: null })).toEqual({ state: 'none' });
  });
});
