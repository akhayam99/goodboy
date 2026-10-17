// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pageCountWordOf, type CountedPageId, type PageCountFacts } from './pageCountWord';

const COUNTED_PAGE_IDS = [
  'runs',
  'orchestrated',
  'agents',
  'auto',
  'artifacts',
  'questions',
] as const satisfies ReadonlyArray<CountedPageId>;

const QUIET: PageCountFacts = {
  runs: 0,
  runningRuns: 0,
  waitingRuns: 0,
  orchestratedRuns: 0,
  runningOrchestratedRuns: 0,
  waitingOrchestratedRuns: 0,
  agents: 0,
  runningAgents: 0,
  autoAgents: 0,
  workingAutoAgents: 0,
  artifacts: 0,
  openQuestions: 0,
};

const wordOf = (page: CountedPageId, facts: Partial<PageCountFacts>): string | null =>
  pageCountWordOf({ page, facts: { ...QUIET, ...facts } });

describe('pageCountWordOf', () => {
  it.each(COUNTED_PAGE_IDS)('is empty on %s when there is nothing to count', (page) => {
    expect(wordOf(page, {})).toBeNull();
  });

  it.each([
    [{ runs: 4 }, '4 runs'],
    [{ runs: 1 }, '1 run'],
    [{ runs: 4, runningRuns: 2 }, '2 running'],
    [{ runningRuns: 1, runs: 1 }, '1 running'],
    [{ runs: 0, runningRuns: 0 }, null],
  ])('reads Runs for %j as %s', (facts, expected) => {
    expect(wordOf('runs', facts)).toBe(expected);
  });

  it.each([
    [{ orchestratedRuns: 2 }, '2 runs'],
    [{ orchestratedRuns: 2, runningOrchestratedRuns: 1 }, '1 running'],
    [{ runs: 3 }, null],
  ])('reads Orchestrated for %j as %s', (facts, expected) => {
    expect(wordOf('orchestrated', facts)).toBe(expected);
  });

  it.each([
    [{ agents: 3 }, '3 agents'],
    [{ agents: 1 }, '1 agent'],
    [{ agents: 3, runningAgents: 1 }, '1 running'],
  ])('reads Agents for %j as %s', (facts, expected) => {
    expect(wordOf('agents', facts)).toBe(expected);
  });

  it.each([
    [{ autoAgents: 2 }, '2 conversations'],
    [{ autoAgents: 1 }, '1 conversation'],
    [{ autoAgents: 2, workingAutoAgents: 1 }, '1 working'],
  ])('reads Auto agents for %j as %s', (facts, expected) => {
    expect(wordOf('auto', facts)).toBe(expected);
  });

  it.each([
    [{ artifacts: 4 }, '4 artifacts'],
    [{ artifacts: 1 }, '1 artifact'],
  ])('reads Artifacts for %j as %s', (facts, expected) => {
    expect(wordOf('artifacts', facts)).toBe(expected);
  });

  it('names a run that waits on you before a running one', () => {
    expect(wordOf('runs', { runs: 3, runningRuns: 1, waitingRuns: 2 })).toBe('2 need you');
    expect(wordOf('orchestrated', { orchestratedRuns: 1, waitingOrchestratedRuns: 1 })).toBe(
      '1 needs you',
    );
  });

  it('reads Questions as the number open', () => {
    expect(wordOf('questions', { openQuestions: 2 })).toBe('2 open');
  });

  it('puts the noun last and never a bare number', () => {
    const everything: PageCountFacts = {
      runs: 4,
      runningRuns: 0,
      waitingRuns: 0,
      orchestratedRuns: 1,
      runningOrchestratedRuns: 0,
      waitingOrchestratedRuns: 0,
      agents: 3,
      runningAgents: 0,
      autoAgents: 2,
      workingAutoAgents: 0,
      artifacts: 4,
      openQuestions: 2,
    };
    for (const page of COUNTED_PAGE_IDS) {
      expect(pageCountWordOf({ page, facts: everything })).toMatch(/^\d+ [a-z]+$/);
    }
  });
});
