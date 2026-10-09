// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  COUNTED_PAGE_IDS,
  pageCountWordOf,
  type CountedPageId,
  type PageCountFacts,
} from './pageCountWord';

const QUIET: PageCountFacts = {
  waiting: 0,
  notes: 0,
  mounts: 1,
  runs: 0,
  runningRuns: 0,
  agents: 0,
  runningAgents: 0,
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
    [{ waiting: 5 }, '5 need you'],
    [{ waiting: 1 }, '1 need you'],
    [{ waiting: 5, mounts: 3 }, '5 need you'],
    [{ notes: 1 }, '1 note'],
    [{ notes: 2 }, '2 notes'],
    [{ waiting: 3, notes: 1 }, '3 need you · 1 note'],
    [{ notes: 1, mounts: 3 }, '1 note'],
    [{ mounts: 3 }, '3 branches'],
    [{ mounts: 2 }, '2 branches'],
    [{ mounts: 1 }, null],
  ])('reads Branch for %j as %s', (facts, expected) => {
    expect(wordOf('branch', facts)).toBe(expected);
  });

  it.each([
    [{ runs: 4 }, '4 runs'],
    [{ runs: 1 }, '1 run'],
    [{ runs: 4, runningRuns: 2 }, '2 running'],
    [{ runningRuns: 1, runs: 1 }, '1 running'],
  ])('reads Runs for %j as %s', (facts, expected) => {
    expect(wordOf('runs', facts)).toBe(expected);
  });

  it.each([
    [{ agents: 3 }, '3 agents'],
    [{ agents: 1 }, '1 agent'],
    [{ agents: 3, runningAgents: 1 }, '1 running'],
  ])('reads Agents for %j as %s', (facts, expected) => {
    expect(wordOf('agents', facts)).toBe(expected);
  });

  it.each([
    [{ artifacts: 4 }, '4 artifacts'],
    [{ artifacts: 1 }, '1 artifact'],
  ])('reads Artifacts for %j as %s', (facts, expected) => {
    expect(wordOf('artifacts', facts)).toBe(expected);
  });

  it('reads Questions as the number open', () => {
    expect(wordOf('questions', { openQuestions: 2 })).toBe('2 open');
  });

  it('puts the noun last and never a bare number', () => {
    const everything: PageCountFacts = {
      waiting: 0,
      notes: 0,
      mounts: 4,
      runs: 4,
      runningRuns: 0,
      agents: 3,
      runningAgents: 0,
      artifacts: 4,
      openQuestions: 2,
    };
    for (const page of COUNTED_PAGE_IDS) {
      expect(pageCountWordOf({ page, facts: everything })).toMatch(/^\d+ [a-z]+$/);
    }
  });
});
