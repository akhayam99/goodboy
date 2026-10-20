// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '@goodboy/types';
import { doneRowsOf } from '../central/done/doneRowsOf';
import { eventOf, modelOf, NOW } from '../central/done/testing/doneFixtures';
import {
  branchEvents,
  manyBranchEvents as nine,
  rebaseRequest as request,
  stamp,
} from '../central/done/testing/historyBatchFixtures';
import { buildTimelineStream, type TimelineStreamItem } from './buildTimelineStream';
import { dayLabel } from './dayLabel';

const streamOf = ({ events }: { readonly events: ReadonlyArray<SessionEvent> }) =>
  buildTimelineStream({
    entries: modelOf({ events }).entries,
    unreadAgentIds: new Set(),
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    dayLabelFor: ({ at }) => dayLabel({ at, now: NOW }),
    expandedGroupIds: new Set(),
    foldsFinished: false,
    shouldFoldHistoryBatches: true,
  }).items;

const rowsOf = (items: ReadonlyArray<TimelineStreamItem>) =>
  items.flatMap((item) => (item.kind === 'row' ? [item] : []));

const batchOf = (item: TimelineStreamItem | undefined) =>
  item?.kind === 'row' && item.entry.kind === 'event' ? item.entry.historyBatch : undefined;

const foldedOf = ({ events }: { readonly events: ReadonlyArray<SessionEvent> }) =>
  rowsOf(streamOf({ events })).find((item) => batchOf(item) !== undefined);

const doneRowOf = ({ events }: { readonly events: ReadonlyArray<SessionEvent> }) =>
  doneRowsOf({
    model: modelOf({ events }),
    source: null,
    costs: { byAgentId: new Map(), byRunId: new Map() },
  }).flatMap((day) => day.rows)[0];

describe('the log folds a batch of history events', () => {
  it('folds the 18 lines of one Rebase all into one entry', () => {
    const events = [request, ...nine({ count: 9, batchId: 'run-1' })];

    const batch = batchOf(foldedOf({ events }));

    expect(rowsOf(streamOf({ events })).filter((row) => batchOf(row) !== undefined)).toHaveLength(
      1,
    );
    expect(batch?.title).toBe('Rebased 9 branches on main');
    expect(batch?.sub).toBe('Rebase all · 9 pushed, 3 PRs updated');
    expect(batch?.events).toHaveLength(18);
  });

  it('folds legacy events that carry no batch key', () => {
    const rows = rowsOf(streamOf({ events: nine({ count: 9 }) }));

    expect(rows).toHaveLength(1);
    expect(batchOf(rows[0])?.events).toHaveLength(18);
  });

  it('keeps one branch as its own two lines', () => {
    const rows = rowsOf(streamOf({ events: branchEvents({ index: 0, batchId: 'run-1' }) }));

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => batchOf(row) === undefined)).toBe(true);
  });

  it('folds a batch of plan pushes apart from a rebase batch of the same session', () => {
    const rebase = [0, 1].flatMap((index) => branchEvents({ index, batchId: 'run-1' }));
    const pushes = [2, 3, 4].flatMap((index) =>
      branchEvents({ index, origin: 'plan', minuteOffset: 30 }),
    );

    const titles = rowsOf(streamOf({ events: [...rebase, ...pushes] })).map(
      (row) => batchOf(row)?.title,
    );

    expect(titles).toEqual(['Rewrote 3 branches', 'Rebased 2 branches']);
  });

  it('leaves the other events of the session around the fold alone', () => {
    const pr = eventOf({
      id: 'ev-pr',
      kind: 'pr_created',
      payload: { number: 42 },
      createdAt: stamp({ minute: 30, second: 0 }),
    });

    const ids = rowsOf(streamOf({ events: [pr, ...nine({ count: 9, batchId: 'run-1' })] })).map(
      (row) => row.id,
    );

    expect(ids).toEqual(['event:ev-pr', 'event:ps-8']);
  });

  it('is the entry that Show in log on the done row targets', () => {
    const events = [request, ...nine({ count: 9, batchId: 'run-1' })];

    const folded = foldedOf({ events });

    expect(doneRowOf({ events })?.entryId).toBe(folded?.id);
    expect(doneRowOf({ events })?.title).toBe(batchOf(folded)?.title);
  });

  it('keeps the same target for a legacy batch', () => {
    const events = [request, ...nine({ count: 9 })];

    expect(doneRowOf({ events })?.entryId).toBe(foldedOf({ events })?.id);
  });
});
