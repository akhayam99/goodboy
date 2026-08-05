import { describe, expect, it } from 'vitest';
import type { BitbucketPullRequest } from '../client';
import { focusedBitbucketPr } from './focusedBitbucketPr';

const buildPr = (id: number, title: string): BitbucketPullRequest => ({
  id,
  title,
  description: '',
  state: 'OPEN',
  createdOn: '2026-08-01T10:00:00Z',
  updatedOn: '2026-08-01T11:00:00Z',
  sourceBranch: 'ak/feat-thing',
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: null,
});

describe('focusedBitbucketPr', () => {
  it('takes the freshly fetched copy of the pull request on screen', () => {
    const shown = focusedBitbucketPr({
      focused: buildPr(7, 'stale title'),
      sessionPr: buildPr(7, 'new title'),
    });
    expect(shown?.title).toBe('new title');
  });

  it('never paints another pull request over the one on screen', () => {
    const shown = focusedBitbucketPr({
      focused: buildPr(7, 'on screen'),
      sessionPr: buildPr(9, 'other one'),
    });
    expect(shown?.id).toBe(7);
    expect(shown?.title).toBe('on screen');
  });

  it('falls back to the session pull request before anything is focused', () => {
    const shown = focusedBitbucketPr({ focused: null, sessionPr: buildPr(3, 'branch one') });
    expect(shown?.id).toBe(3);
  });
});
