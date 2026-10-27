import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type { AutoRowFacts } from '../../../auto/autoRowFacts';
import { brandedId } from '../../../history/testing/brandedId';
import {
  rowStateNode,
  rowStateSentence,
  rowStateShortSentence,
} from '../../../workTreeModel/rowStateCopy';
import { buildTimelineGroups } from '../buildTimelineGroups';
import { buildTimelineStream } from '.';
import { dayLabel } from '../dayLabel';

const SESSION_ID = brandedId<SessionId>({ value: 'session-payments' });
const AUTO_ID = brandedId<AgentId>({ value: 'agent-auto' });
const NOW = new Date(2026, 9, 10, 12, 0);

const autoAgent: Agent = {
  id: AUTO_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Auto',
  status: 'completed',
  startedAt: brandedId<IsoDateTime>({ value: new Date(2026, 9, 10, 9, 0).toISOString() }),
  completedAt: brandedId<IsoDateTime>({ value: new Date(2026, 9, 10, 9, 5).toISOString() }),
};

type RowParams = {
  readonly facts?: AutoRowFacts;
};

const rowOf = ({ facts }: RowParams) => {
  const { items } = buildTimelineStream({
    entries: buildTimelineGroups({
      sessionId: SESSION_ID,
      agents: [autoAgent],
      workflows: [],
      plans: [],
      artifacts: [],
      externalTasks: [],
      questions: [],
      worktrees: [],
      events: [],
      agentKindOverride: { [AUTO_ID]: 'auto' },
    }).entries,
    unreadAgentIds: new Set(),
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    dayLabelFor: ({ at }) => dayLabel({ at, now: NOW }),
    ...(facts !== undefined && { autoFactsByAgentId: new Map([[AUTO_ID, facts]]) }),
  });
  const row = items.find((item) => item.kind === 'row' && item.entry.kind === 'agent');
  if (row === undefined || row.kind !== 'row') {
    throw new Error('no agent row');
  }
  return row;
};

describe('the Overview row of an Auto agent', () => {
  it('keeps the state of the agent when the tree has nothing to say', () => {
    const row = rowOf({});

    expect(row.rowState.phase).toBe('done');
    expect(row.rowState.reason).toBeNull();
  });

  it('says what the tree does in one row, with the long word and the short one', () => {
    const row = rowOf({
      facts: { phase: 'running', word: 'Waiting for Implementer and Tester', short: 'Waiting' },
    });

    expect(row.rowState.phase).toBe('running');
    expect(rowStateSentence({ state: row.rowState })).toBe('Waiting for Implementer and Tester');
    expect(rowStateShortSentence({ state: row.rowState })).toBe('Waiting');
    expect(rowStateNode({ state: row.rowState })).toMatchObject({
      state: 'running',
      label: 'Waiting for Implementer and Tester',
    });
  });

  it('shows a plan that waits for approval as a row that needs you', () => {
    const row = rowOf({
      facts: { phase: 'waiting', word: 'Needs your approval', short: 'Needs you' },
    });

    expect(row.rowState.phase).toBe('waiting');
    expect(rowStateSentence({ state: row.rowState })).toBe('Needs your approval');
  });
});
