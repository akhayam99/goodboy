import { describe, expect, it } from 'vitest';
import type { PrCheckRun } from '@goodboy/types';
import { wantsYouFactsOf, worktreeEntryFactsOf } from './worktreeEntryFacts';

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
  diff: null,
  commits: null,
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
      diff: null,
      notPushed: null,
    });
  });

  it('draws no zero and nothing while a count is not loaded', () => {
    expect(worktreeEntryFactsOf(BASE).files.text).toBe('12');
    expect(worktreeEntryFactsOf({ ...BASE, files: 0 }).files.text).toBeNull();
    expect(worktreeEntryFactsOf({ ...BASE, files: null }).files.text).toBeNull();
    expect(worktreeEntryFactsOf(BASE).commits.text).toBeNull();
  });

  it('puts the diff stat beside the file count and says both in the tooltip', () => {
    const facts = worktreeEntryFactsOf({ ...BASE, diff: { additions: 652, deletions: 99 } });
    expect(facts.files).toEqual({
      text: '12',
      tone: null,
      tooltip: '12 files · +652 -99',
      diff: { additions: 652, deletions: 99 },
      notPushed: null,
    });
    expect(
      worktreeEntryFactsOf({ ...BASE, files: null, diff: { additions: 4, deletions: 0 } }).files,
    ).toEqual({
      text: null,
      tone: null,
      tooltip: '+4 -0',
      diff: { additions: 4, deletions: 0 },
      notPushed: null,
    });
    expect(worktreeEntryFactsOf({ ...BASE, diff: { additions: 0, deletions: 0 } }).files.diff).toBe(
      null,
    );
  });

  it('marks the commits not pushed with an arrow and says it in the tooltip', () => {
    expect(worktreeEntryFactsOf({ ...BASE, notPushed: 2 }).commits).toEqual({
      text: '↑2',
      tone: null,
      tooltip: '2 not pushed',
      diff: null,
      notPushed: null,
    });
  });

  it('counts failing checks in danger, running ones in info, and nothing when all passed', () => {
    expect(
      worktreeEntryFactsOf({ ...BASE, checks: [run('failure'), run('success')] }).checks,
    ).toEqual({ text: '1', tone: 'danger', tooltip: '1 failing', diff: null, notPushed: null });
    expect(worktreeEntryFactsOf({ ...BASE, checks: [run('pending')] }).checks).toEqual({
      text: '1',
      tone: 'info',
      tooltip: '1 running',
      diff: null,
      notPushed: null,
    });
    expect(worktreeEntryFactsOf(BASE).checks.text).toBeNull();
  });

  it('says nothing for checks it could not read, the reason in the tooltip, never a zero', () => {
    expect(
      worktreeEntryFactsOf({ ...BASE, checks: null, checksUnreadReason: 'Checks unknown' }).checks,
    ).toEqual({ text: null, tone: null, tooltip: 'Checks unknown', diff: null, notPushed: null });
  });

  it('counts the commits and keeps the ones not pushed beside the count', () => {
    expect(worktreeEntryFactsOf({ ...BASE, commits: 11, notPushed: 3 }).commits).toEqual({
      text: '11',
      tone: null,
      tooltip: '3 not pushed',
      diff: null,
      notPushed: 3,
    });
    expect(worktreeEntryFactsOf({ ...BASE, commits: 11, notPushed: 0 }).commits).toMatchObject({
      text: '11',
      notPushed: null,
    });
  });
});

describe('the tab badges of the branch page', () => {
  const quiet = (overrides: Partial<typeof BASE>) =>
    wantsYouFactsOf({ facts: worktreeEntryFactsOf({ ...BASE, ...overrides }) });

  it('badge only the comments that need you and the checks that fail', () => {
    const facts = quiet({
      pullRequestState: 'merged',
      commentsNeedYou: 3,
      commits: 4,
      notPushed: 1,
      checks: [run('failure')],
    });
    const badged = Object.entries(facts)
      .filter(([, fact]) => fact.text !== null)
      .map(([tab]) => tab);
    expect(badged).toEqual(['comments', 'checks']);
    expect(facts.comments).toEqual(worktreeEntryFactsOf({ ...BASE, commentsNeedYou: 3 }).comments);
  });

  it('keeps the counts, the diff and the pushed state in the tooltip of a quiet tab', () => {
    const facts = quiet({
      commits: 11,
      notPushed: 3,
      diff: { additions: 652, deletions: 99 },
    });
    expect(facts.files).toEqual({
      text: null,
      tone: null,
      tooltip: '12 files · +652 -99',
      diff: null,
      notPushed: null,
    });
    expect(facts.commits.tooltip).toBe('11 commits · 3 not pushed');
    expect(facts.pr.tooltip).toBe('Draft');
  });

  it('keeps running checks to the tooltip and says nothing when nothing is known', () => {
    expect(quiet({ checks: [run('pending')] }).checks).toEqual({
      text: null,
      tone: null,
      tooltip: '1 running',
      diff: null,
      notPushed: null,
    });
    expect(
      quiet({ files: null, commits: null, pullRequestState: 'open' }).files.tooltip,
    ).toBeNull();
    expect(quiet({ pullRequestState: 'open' }).pr.tooltip).toBeNull();
  });
});
