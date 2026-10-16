// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PageCountFacts } from './pageCountWord';
import { pageSlotOf } from './pageSlot';

const QUIET: PageCountFacts = {
  runs: 0,
  runningRuns: 0,
  orchestratedRuns: 0,
  runningOrchestratedRuns: 0,
  agents: 0,
  runningAgents: 0,
  artifacts: 0,
  openQuestions: 0,
};

describe('pageSlotOf', () => {
  it('leaves the slot empty for a page with nothing to count', () => {
    expect(pageSlotOf({ page: 'runs', facts: QUIET })).toEqual({
      count: null,
      isRunning: false,
      isWarning: false,
      fact: null,
    });
    expect(pageSlotOf({ page: null, facts: { ...QUIET, runs: 3 } }).count).toBeNull();
  });

  it('shows the total and a running dot while one runs, the word in the tooltip', () => {
    expect(pageSlotOf({ page: 'runs', facts: { ...QUIET, runs: 3, runningRuns: 1 } })).toEqual({
      count: 3,
      isRunning: true,
      isWarning: false,
      fact: '1 running',
    });
    expect(pageSlotOf({ page: 'agents', facts: { ...QUIET, agents: 2 } })).toEqual({
      count: 2,
      isRunning: false,
      isWarning: false,
      fact: '2 agents',
    });
  });

  it('counts orchestrated runs apart from preset runs', () => {
    const facts = { ...QUIET, runs: 2, orchestratedRuns: 1, runningOrchestratedRuns: 1 };
    expect(pageSlotOf({ page: 'orchestrated', facts })).toEqual({
      count: 1,
      isRunning: true,
      isWarning: false,
      fact: '1 running',
    });
    expect(pageSlotOf({ page: 'runs', facts }).isRunning).toBe(false);
  });

  it('marks open questions with the warning dot', () => {
    expect(pageSlotOf({ page: 'questions', facts: { ...QUIET, openQuestions: 1 } })).toEqual({
      count: 1,
      isRunning: false,
      isWarning: true,
      fact: '1 open',
    });
  });
});
