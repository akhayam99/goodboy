import { describe, expect, it } from 'vitest';
import { worktreeEntryFactsOf } from './worktreeEntryFacts';

const BASE: Parameters<typeof worktreeEntryFactsOf>[0] = {
  pullRequest: { label: '#418', state: 'draft' },
  comments: 3,
  commentsWaiting: 0,
  files: 12,
  commits: 7,
  notPushed: 0,
  checks: 4,
  checksFailed: 0,
};

describe('the facts of the worktree entries', () => {
  it('names the pull request with its number and its state word, or None', () => {
    expect(worktreeEntryFactsOf(BASE).pr.text).toBe('#418 Draft');
    expect(
      worktreeEntryFactsOf({ ...BASE, pullRequest: { label: '#418', state: 'open' } }).pr.text,
    ).toBe('#418');
    expect(worktreeEntryFactsOf({ ...BASE, pullRequest: null }).pr.text).toBe('None');
  });

  it('counts comments, files and commits, and says Not loaded as null', () => {
    const facts = worktreeEntryFactsOf({ ...BASE, comments: null });
    expect(facts.comments).toEqual({ text: null, tone: null });
    expect(facts.files.text).toBe('12');
    expect(facts.commits.text).toBe('7');
  });

  it('marks comments that wait on you with a warning', () => {
    expect(worktreeEntryFactsOf({ ...BASE, commentsWaiting: 2 }).comments.tone).toBe('warning');
  });

  it('says commits not pushed before the commit count', () => {
    expect(worktreeEntryFactsOf({ ...BASE, notPushed: 2 }).commits).toEqual({
      text: '2 not pushed',
      tone: null,
    });
  });

  it('says failed checks in danger, and nothing while the checks are unread', () => {
    expect(worktreeEntryFactsOf({ ...BASE, checksFailed: 1 }).checks).toEqual({
      text: '1 failed',
      tone: 'danger',
    });
    expect(worktreeEntryFactsOf({ ...BASE, checks: null }).checks.text).toBe('');
  });
});
