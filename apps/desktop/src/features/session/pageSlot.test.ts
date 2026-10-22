// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PageCountFacts } from './pageCountWord';
import { pageSlotOf } from './pageSlot';

const QUIET: PageCountFacts = {
  changedFiles: 0,
  runs: 0,
  runningRuns: 0,
  waitingRuns: 0,
  artifacts: 0,
  openQuestions: 0,
};

describe('pageSlotOf', () => {
  it('leaves the slot empty for a page with nothing to count', () => {
    expect(pageSlotOf({ page: 'runs', facts: QUIET })).toEqual({
      text: null,
      tone: null,
      fact: null,
    });
    expect(pageSlotOf({ page: null, facts: { ...QUIET, runs: 3 } }).text).toBeNull();
  });

  it('shows the running count beside the info dot while one runs, the total at rest', () => {
    expect(pageSlotOf({ page: 'runs', facts: { ...QUIET, runs: 3, runningRuns: 1 } })).toEqual({
      text: '1',
      tone: 'info',
      fact: '1 running',
    });
    expect(pageSlotOf({ page: 'artifacts', facts: { ...QUIET, artifacts: 2 } })).toEqual({
      text: '2',
      tone: null,
      fact: '2 artifacts',
    });
  });

  it('puts a run that waits on you or failed on the warning dot, ahead of a running one', () => {
    const facts = { ...QUIET, runs: 4, runningRuns: 2, waitingRuns: 1 };
    expect(pageSlotOf({ page: 'runs', facts })).toEqual({
      text: '1',
      tone: 'warning',
      fact: '1 needs you',
    });
  });

  it('marks open questions with the warning dot', () => {
    expect(pageSlotOf({ page: 'questions', facts: { ...QUIET, openQuestions: 1 } })).toEqual({
      text: '1',
      tone: 'warning',
      fact: '1 open',
    });
  });
});
