import { describe, expect, it } from 'vitest';
import { anAgent } from '@goodboy/types/testing';
import type { Agent } from '@goodboy/types';
import type { TimelineAgentEntry } from './buildTimelineGroups';
import { formatClock } from '../../../shared/utils/time/formatClock';
import { clockSpanCardOf, latestFinishOf } from './clockSpan';

const clock = (at: string) => formatClock({ at });

const STARTED = '2026-10-04T16:41:00Z';
const FINISHED = '2026-10-04T16:57:00Z';

describe('clockSpanCardOf', () => {
  it('gives started and finished rows for a finished row', () => {
    const card = clockSpanCardOf({ startedAt: STARTED, finishedAt: FINISHED, phase: 'done' });

    expect(card.facts).toEqual([
      { label: 'Started', value: clock(STARTED) },
      { label: 'Finished', value: clock(FINISHED) },
    ]);
    expect(card.state).toBeUndefined();
  });

  it('reads a failed or closed row the same way', () => {
    for (const phase of ['failed', 'closed'] as const) {
      const card = clockSpanCardOf({ startedAt: STARTED, finishedAt: FINISHED, phase });

      expect(card.facts.map((fact) => fact.label)).toEqual(['Started', 'Finished']);
    }
  });

  it('says running for a live row and gives no finish', () => {
    const card = clockSpanCardOf({ startedAt: STARTED, finishedAt: FINISHED, phase: 'running' });

    expect(card.state).toEqual({ tone: 'info', words: 'Running', isRunning: true });
    expect(card.facts.map((fact) => fact.label)).toEqual(['Started']);
  });

  it('stops at the start for a row that waits, and for one with no finish on record', () => {
    const waiting = clockSpanCardOf({ startedAt: STARTED, finishedAt: FINISHED, phase: 'waiting' });
    const unfinished = clockSpanCardOf({ startedAt: STARTED, finishedAt: null, phase: 'done' });

    expect(waiting.facts).toHaveLength(1);
    expect(unfinished.facts).toHaveLength(1);
  });

  it('carries no joined middot text', () => {
    const card = clockSpanCardOf({ startedAt: STARTED, finishedAt: FINISHED, phase: 'done' });

    expect(JSON.stringify(card)).not.toContain(' · ');
  });
});

const entryOf = ({
  agent,
  children = [],
}: {
  readonly agent: Partial<Agent>;
  readonly children?: ReadonlyArray<TimelineAgentEntry>;
}): TimelineAgentEntry => ({
  kind: 'agent',
  id: 'agent:entry',
  at: null,
  ordinal: 0,
  agent: anAgent(agent),
  agentKind: 'implementer',
  isMissingArtifact: false,
  stepLabel: null,
  openQuestions: [],
  terminalQuestions: [],
  children,
  answers: [],
  hasDuration: true,
  chain: null,
});

describe('latestFinishOf', () => {
  it('reads the latest finish of the steps, nested ones included', () => {
    const entries = [
      entryOf({
        agent: { completedAt: '2026-10-04T16:20:00Z' as Agent['completedAt'] },
        children: [
          entryOf({ agent: { completedAt: '2026-10-04T17:10:00Z' as Agent['completedAt'] } }),
        ],
      }),
      entryOf({ agent: { completedAt: '2026-10-04T16:50:00Z' as Agent['completedAt'] } }),
    ];

    expect(latestFinishOf({ entries })).toBe(Date.parse('2026-10-04T17:10:00Z'));
  });

  it('falls back to the last finish of an agent that was resumed after it completed', () => {
    const entries = [
      entryOf({ agent: { lastFinishedAt: '2026-10-04T17:03:00Z' as Agent['lastFinishedAt'] } }),
    ];

    expect(latestFinishOf({ entries })).toBe(Date.parse('2026-10-04T17:03:00Z'));
  });

  it('has no finish while nothing has finished', () => {
    expect(latestFinishOf({ entries: [entryOf({ agent: {} })] })).toBeNull();
    expect(latestFinishOf({ entries: [] })).toBeNull();
  });
});
