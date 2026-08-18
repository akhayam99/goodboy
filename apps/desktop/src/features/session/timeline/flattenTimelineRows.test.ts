import { describe, expect, it } from 'vitest';
import type { TimelineAgentEntry, TimelineRunEntry } from './buildTimelineGroups';
import { flattenTimelineRows, withDayBreaks } from './flattenTimelineRows';
import { runIdentity } from './runIdentity';
import { dayLabel } from '../components/SessionWorkspace/parts/TimelinePane/dayLabel';

type AgentEntryParams = {
  readonly id: string;
  readonly at: string | null;
  readonly children?: ReadonlyArray<TimelineAgentEntry>;
};

const agentEntry = ({ id, at, children = [] }: AgentEntryParams): TimelineAgentEntry =>
  ({
    kind: 'agent',
    id,
    at,
    ordinal: 0,
    agent: { id, name: id, status: 'completed' },
    agentKind: 'implementer',
    stepLabel: null,
    openQuestions: [],
    terminalQuestions: [],
    children,
    answers: [],
    hasDuration: false,
  }) as unknown as TimelineAgentEntry;

type RunEntryParams = {
  readonly runId: string;
  readonly at: string;
  readonly children: ReadonlyArray<TimelineAgentEntry>;
};

const runEntry = ({ runId, at, children }: RunEntryParams): TimelineRunEntry =>
  ({
    kind: 'run',
    id: `run:${runId}`,
    at,
    run: { id: runId },
    workflow: { name: 'Release workflow' },
    identity: runIdentity({ runId }),
    children,
    producedPlan: null,
  }) as unknown as TimelineRunEntry;

describe('flattenTimelineRows', () => {
  it('hides the children of a collapsed run and reveals them one level deeper when expanded', () => {
    const run = runEntry({
      runId: 'run-1',
      at: '2026-08-17T09:00:00Z',
      children: [agentEntry({ id: 'agent:step', at: '2026-08-17T09:30:00Z' })],
    });

    expect(flattenTimelineRows({ entries: [run], expandedIds: new Set() })).toHaveLength(1);
    expect(
      flattenTimelineRows({ entries: [run], expandedIds: new Set(['run:run-1']) }).map(
        (row) => `${row.id}@${row.depth}`,
      ),
    ).toEqual(['run:run-1@0', 'agent:step@1']);
  });

  it('carries the run identity onto every row of the run and onto no other row', () => {
    const run = runEntry({
      runId: 'run-1',
      at: '2026-08-17T09:00:00Z',
      children: [agentEntry({ id: 'agent:step', at: '2026-08-17T09:30:00Z' })],
    });
    const rows = flattenTimelineRows({
      entries: [run, agentEntry({ id: 'agent:loose', at: '2026-08-17T08:00:00Z' })],
      expandedIds: new Set(['run:run-1']),
    });

    expect(rows.map((row) => row.runId)).toEqual(['run-1', 'run-1', null]);
    expect(rows[1]?.identity).toEqual(rows[0]?.identity);
    expect(rows[2]?.identity).toBeNull();
  });

  it('stops nesting at two levels so indentation cannot run away', () => {
    const grandchild = agentEntry({ id: 'agent:c', at: '2026-08-17T09:40:00Z' });
    const child = agentEntry({
      id: 'agent:b',
      at: '2026-08-17T09:30:00Z',
      children: [grandchild],
    });
    const run = runEntry({ runId: 'run-1', at: '2026-08-17T09:00:00Z', children: [child] });
    const rows = flattenTimelineRows({
      entries: [run],
      expandedIds: new Set(['run:run-1', 'agent:b']),
    });

    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2]);
  });
});

describe('withDayBreaks', () => {
  const localIso = ({
    day,
    hour,
    minute = 0,
  }: {
    readonly day: number;
    readonly hour: number;
    readonly minute?: number;
  }): string => new Date(2026, 7, day, hour, minute).toISOString();

  const now = new Date(2026, 7, 18, 12, 0);
  const labelFor = ({ at }: { readonly at: string }) => dayLabel({ at, now });

  it('has no divider for today and one for each earlier day', () => {
    const rows = flattenTimelineRows({
      entries: [
        agentEntry({ id: 'agent:today', at: localIso({ day: 18, hour: 9 }) }),
        agentEntry({ id: 'agent:yesterday', at: localIso({ day: 17, hour: 9 }) }),
        agentEntry({ id: 'agent:before', at: localIso({ day: 16, hour: 9 }) }),
      ],
      expandedIds: new Set(),
    });
    const items = withDayBreaks({ rows, labelFor });

    expect(items.map((item) => item.kind)).toEqual(['row', 'day', 'row', 'day', 'row']);
    expect(
      items.flatMap((item) => (item.kind === 'day' ? [labelFor({ at: item.at })] : [])),
    ).toEqual(['Yesterday', 'Aug 16']);
  });

  it('keeps the coloured segment across a divider that splits one run', () => {
    const run = runEntry({
      runId: 'run-1',
      at: localIso({ day: 18, hour: 0, minute: 20 }),
      children: [
        agentEntry({ id: 'agent:late', at: localIso({ day: 18, hour: 0, minute: 10 }) }),
        agentEntry({ id: 'agent:early', at: localIso({ day: 17, hour: 23, minute: 55 }) }),
      ],
    });
    const rows = flattenTimelineRows({ entries: [run], expandedIds: new Set(['run:run-1']) });
    const items = withDayBreaks({ rows, labelFor });
    const day = items.find((item) => item.kind === 'day');

    expect(day?.kind === 'day' ? day.identity : null).toEqual(runIdentity({ runId: 'run-1' }));
  });

  it('leaves the divider uncoloured when the day change also changes run', () => {
    const rows = flattenTimelineRows({
      entries: [
        runEntry({ runId: 'run-1', at: localIso({ day: 18, hour: 9 }), children: [] }),
        runEntry({ runId: 'run-2', at: localIso({ day: 17, hour: 9 }), children: [] }),
      ],
      expandedIds: new Set(),
    });
    const items = withDayBreaks({ rows, labelFor });
    const day = items.find((item) => item.kind === 'day');

    expect(day?.kind === 'day' ? day.identity : 'missing').toBeNull();
  });
});
