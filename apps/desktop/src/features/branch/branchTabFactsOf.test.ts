import { describe, expect, it } from 'vitest';
import { branchTabFactsOf, filesHeadFactOf } from './branchTabFactsOf';

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

describe('filesHeadFactOf', () => {
  it('counts the files and lines of the loaded diff', () => {
    const fact = filesHeadFactOf({
      files: [
        { additions: 3, deletions: 1 },
        { additions: 2, deletions: 0 },
      ],
    });

    expect(fact.text).toBe('2');
    expect(fact.count).toBe(2);
    expect(fact.diff).toEqual({ additions: 5, deletions: 1 });
  });

  it('draws nothing for an empty diff', () => {
    const fact = filesHeadFactOf({ files: [] });

    expect(fact.text).toBeNull();
    expect(fact.diff).toBeNull();
  });
});

describe('the Work fact', () => {
  const WORK = {
    runs: 3,
    runsNeedYou: 0,
    running: 2,
    questions: 0,
    waiting: 0,
    held: 0,
    artifacts: 0,
    artifactsNeedYou: 0,
  } as const;

  it('wants you for a run that needs you, ahead of the runs working', () => {
    const fact = branchTabFactsOf({ ...BASE, work: { ...WORK, runsNeedYou: 1 } }).work;

    expect(fact.text).toBe('1');
    expect(fact.tone).toBe('warning');
    expect(fact.tooltip).toBe('1 run needs you · 2 runs working · 3 runs');
  });

  it('counts a run and the question it waits on as one, and names the question', () => {
    const fact = branchTabFactsOf({
      ...BASE,
      work: { ...WORK, runsNeedYou: 1, questions: 1, held: 1 },
    }).work;

    expect(fact.text).toBe('1');
    expect(fact.tooltip).toBe(
      '1 run needs you with 1 question · 2 runs working · 3 runs, 1 question',
    );
  });

  it('hides a zero count and shows any other', () => {
    const empty = { ...WORK, runs: 0, running: 0 };
    expect(branchTabFactsOf({ ...BASE, work: empty }).work.text).toBeNull();
    expect(branchTabFactsOf({ ...BASE, work: { ...empty, artifacts: 1 } }).work.text).toBe('1');
  });

  it('reads the runs working in info, else a faint total', () => {
    expect(branchTabFactsOf({ ...BASE, work: WORK }).work.tone).toBe('info');
    const idle = branchTabFactsOf({ ...BASE, work: { ...WORK, running: 0 } }).work;
    expect(idle.text).toBe('3');
    expect(idle.tone).toBeNull();
  });
});
