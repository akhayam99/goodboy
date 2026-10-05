import { describe, expect, it } from 'vitest';
import { anAgent } from '@goodboy/types/testing';
import type { Agent } from '@goodboy/types';
import type { TimelineAgentEntry } from './buildTimelineGroups';
import { formatClock } from '../../../shared/utils/time/formatClock';
import { clockSpanText, latestFinishOf } from './clockSpan';

const clock = (at: string) => formatClock({ at });

const STARTED = '2026-10-04T16:41:00Z';
const FINISHED = '2026-10-04T16:57:00Z';

describe('clockSpanText', () => {
  it('reads started and finished for a finished row', () => {
    expect(clockSpanText({ startedAt: STARTED, finishedAt: FINISHED, phase: 'done' })).toBe(
      `Started ${clock(STARTED)} · finished ${clock(FINISHED)}`,
    );
  });

  it('reads a failed or closed row the same way', () => {
    for (const phase of ['failed', 'closed'] as const) {
      expect(clockSpanText({ startedAt: STARTED, finishedAt: FINISHED, phase })).toContain(
        `finished ${clock(FINISHED)}`,
      );
    }
  });

  it('says running for a live row and prints no finish', () => {
    expect(clockSpanText({ startedAt: STARTED, finishedAt: FINISHED, phase: 'running' })).toBe(
      `Started ${clock(STARTED)} · running`,
    );
  });

  it('stops at the start for a row that waits, and for one with no finish on record', () => {
    expect(clockSpanText({ startedAt: STARTED, finishedAt: FINISHED, phase: 'waiting' })).toBe(
      `Started ${clock(STARTED)}`,
    );
    expect(clockSpanText({ startedAt: STARTED, finishedAt: null, phase: 'done' })).toBe(
      `Started ${clock(STARTED)}`,
    );
  });

  it('never repeats one sentence across rows', () => {
    const first = clockSpanText({ startedAt: STARTED, finishedAt: FINISHED, phase: 'done' });
    const second = clockSpanText({
      startedAt: '2026-10-04T18:45:00Z',
      finishedAt: '2026-10-04T19:02:00Z',
      phase: 'done',
    });

    expect(first).not.toBe(second);
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
