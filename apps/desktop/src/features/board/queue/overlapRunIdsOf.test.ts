import { describe, expect, it } from 'vitest';
import { overlapRunIdsOf } from './overlapRunIdsOf';
import type { RunningGroup, RunningRow } from './runningGroupsOf';

type RowParams = {
  readonly runId: string;
  readonly who: string;
  readonly mountId: string | null;
};

const rowOf = ({ runId, who, mountId }: RowParams): RunningRow => ({
  runId,
  agentId: `agent-${runId}`,
  sessionId: 'session-ledger',
  mountId,
  who,
  phrase: 'Running pnpm test',
  project: 'ledger-core',
  startedAt: 1,
  isQueued: false,
});

type GroupParams = {
  readonly rows: ReadonlyArray<RunningRow>;
};

const groupOf = ({ rows }: GroupParams): RunningGroup => ({
  sessionId: 'session-ledger',
  title: 'Fix webhook retries',
  rows,
});

describe('overlapRunIdsOf', () => {
  it('picks the Implementer row of each mount, once', () => {
    const groups = [
      groupOf({
        rows: [
          rowOf({ runId: 'tester', who: 'Tester', mountId: 'mount-a' }),
          rowOf({ runId: 'implementer', who: 'Implementer', mountId: 'mount-a' }),
          rowOf({ runId: 'reviewer', who: 'Reviewer', mountId: 'mount-b' }),
        ],
      }),
    ];

    expect([...overlapRunIdsOf({ groups })]).toEqual(['implementer', 'reviewer']);
  });

  it('leaves out a row without a mount', () => {
    const groups = [groupOf({ rows: [rowOf({ runId: 'lead', who: 'Lead', mountId: null })] })];

    expect(overlapRunIdsOf({ groups }).size).toBe(0);
  });
});
