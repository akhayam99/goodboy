import { describe, expect, it } from 'vitest';
import type { PrCheckRun } from '@goodboy/types';
import { worktreeEntryFactsOf } from './worktreeEntryFacts';

const run = (conclusion: PrCheckRun['conclusion']): PrCheckRun => ({
  name: 'lint',
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

const BASE: Parameters<typeof worktreeEntryFactsOf>[0] = {
  pullRequestState: 'draft',
  commentsNeedYou: 0,
  files: 12,
  notPushed: 0,
  checks: [run('success')],
  checksUnreadReason: null,
};

describe('the facts of the worktree entries', () => {
  it('says Draft, Merged or Closed on the pull request entry, nothing for an open one', () => {
    expect(worktreeEntryFactsOf(BASE).pr.text).toBe('Draft');
    expect(worktreeEntryFactsOf({ ...BASE, pullRequestState: 'merged' }).pr.text).toBe('Merged');
    expect(worktreeEntryFactsOf({ ...BASE, pullRequestState: 'open' }).pr.text).toBeNull();
    expect(worktreeEntryFactsOf({ ...BASE, pullRequestState: 'approved' }).pr.text).toBeNull();
    expect(worktreeEntryFactsOf({ ...BASE, pullRequestState: 'none' }).pr.text).toBeNull();
  });

  it('counts the comments that need you with a warning, nothing at zero', () => {
    expect(worktreeEntryFactsOf(BASE).comments.text).toBeNull();
    expect(worktreeEntryFactsOf({ ...BASE, commentsNeedYou: 2 }).comments).toEqual({
      text: '2',
      tone: 'warning',
      tooltip: '2 need you',
    });
  });

  it('draws no zero and nothing while a count is not loaded', () => {
    expect(worktreeEntryFactsOf(BASE).files.text).toBe('12');
    expect(worktreeEntryFactsOf({ ...BASE, files: 0 }).files.text).toBeNull();
    expect(worktreeEntryFactsOf({ ...BASE, files: null }).files.text).toBeNull();
    expect(worktreeEntryFactsOf(BASE).commits.text).toBeNull();
  });

  it('marks the commits not pushed with an arrow and says it in the tooltip', () => {
    expect(worktreeEntryFactsOf({ ...BASE, notPushed: 2 }).commits).toEqual({
      text: '↑2',
      tone: null,
      tooltip: '2 not pushed',
    });
  });

  it('counts failing checks in danger, running ones in info, and nothing when all passed', () => {
    expect(
      worktreeEntryFactsOf({ ...BASE, checks: [run('failure'), run('success')] }).checks,
    ).toEqual({ text: '1', tone: 'danger', tooltip: '1 failing' });
    expect(worktreeEntryFactsOf({ ...BASE, checks: [run('pending')] }).checks).toEqual({
      text: '1',
      tone: 'info',
      tooltip: '1 running',
    });
    expect(worktreeEntryFactsOf(BASE).checks.text).toBeNull();
  });

  it('says nothing for checks it could not read, the reason in the tooltip, never a zero', () => {
    expect(
      worktreeEntryFactsOf({ ...BASE, checks: null, checksUnreadReason: 'Checks unknown' }).checks,
    ).toEqual({ text: null, tone: null, tooltip: 'Checks unknown' });
  });
});
