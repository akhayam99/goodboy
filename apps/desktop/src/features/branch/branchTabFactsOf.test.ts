import { describe, expect, it } from 'vitest';
import { branchTabFactsOf } from './branchTabFactsOf';

const BASE = {
  pullRequestState: 'open',
  commentsNeedYou: 0,
  commentsOpen: 0,
  files: 6,
  diff: { additions: 142, deletions: 37 },
  commits: 3,
  notPushed: 0,
  checks: null,
  checksUnreadReason: null,
} as const;

describe('branchTabFactsOf', () => {
  it('gives files, lines and commits one value for the tab and the head', () => {
    const facts = branchTabFactsOf(BASE);

    expect(facts.files.text).toBe('6');
    expect(facts.files.diff).toEqual({ additions: 142, deletions: 37 });
    expect(facts.commits.text).toBe('3');
  });

  it('colors a comment count only when it needs you', () => {
    expect(branchTabFactsOf({ ...BASE, commentsOpen: 2 }).comments.tone).toBeNull();
    expect(branchTabFactsOf({ ...BASE, commentsOpen: 2, commentsNeedYou: 1 }).comments.tone).toBe(
      'warning',
    );
  });

  it('draws nothing for a count of zero', () => {
    const facts = branchTabFactsOf({ ...BASE, files: 0, diff: null, commits: 0 });

    expect(facts.files.text).toBeNull();
    expect(facts.commits.text).toBeNull();
    expect(facts.comments.text).toBeNull();
  });
});
