// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { doneRowsOf } from './doneRowsOf';
import type { DoneCosts } from './doneTypes';
import { eventOf, modelOf, SESSION_ID } from './testing/doneFixtures';
import {
  branchEvents,
  manyBranchEvents as many,
  rebaseRequest as request,
  stamp,
} from './testing/historyBatchFixtures';

const NO_COSTS: DoneCosts = { byAgentId: new Map(), byRunId: new Map() };

const rowsOf = (model: Parameters<typeof doneRowsOf>[0]['model']) =>
  doneRowsOf({ model, source: null, costs: NO_COSTS }).flatMap((day) => day.rows);

describe('doneRowsOf batch fold', () => {
  it('turns one Rebase all over nine branches into one row', () => {
    const model = modelOf({ events: [request, ...many({ count: 9, batchId: 'run-1' })] });

    const rows = rowsOf(model);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Rebased 9 branches on main');
    expect(rows[0]?.by).toBe('Rebase all · 9 pushed, 3 PRs updated');
    expect(rows[0]?.mountId).toBeNull();
  });

  it('opens on one line per branch with its push and PR facts', () => {
    const model = modelOf({ events: [request, ...many({ count: 9, batchId: 'run-1' })] });

    const { branches } = rowsOf(model)[0]?.detail ?? { branches: [] };

    expect(branches).toHaveLength(9);
    expect(branches[0]).toEqual({
      id: 'mount-0',
      project: 'payments-api',
      branch: 'hl/branch-0',
      fact: 'Pushed · PR #300 updated',
    });
    expect(branches[8]?.fact).toBe('Pushed');
  });

  it('points Show in log at the one folded entry of the log', () => {
    const model = modelOf({ events: [request, ...many({ count: 9, batchId: 'run-1' })] });

    const [row] = rowsOf(model);

    expect(row?.entryId).toBe('event:ps-8');
    expect(model.entries.some((entry) => entry.id === row?.entryId)).toBe(true);
  });

  it('folds legacy events that carry no batch key', () => {
    const model = modelOf({ events: [request, ...many({ count: 9 })] });

    const rows = rowsOf(model);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Rebased 9 branches on main');
  });

  it('keeps one rebased branch as its own row with today words', () => {
    const model = modelOf({ events: [request, ...branchEvents({ index: 0, batchId: 'run-1' })] });

    const rows = rowsOf(model);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Rebased on main');
    expect(rows[0]?.by).toBe('Rebase');
    expect(rows[0]?.entryId).toBe('event:rw-0');
  });

  it('leaves the branches an agent already owns to that agent row', () => {
    const rebaser = anAgent({
      id: brandId<AgentId>({ value: 'rebaser' }),
      sessionId: SESSION_ID,
      kind: 'rewriter',
      status: 'completed',
      startedAt: stamp({ minute: 0, second: 0 }),
      completedAt: stamp({ minute: 20, second: 0 }),
    });
    const model = modelOf({
      agents: [rebaser],
      events: [
        request,
        ...many({ count: 6, batchId: 'run-1' }),
        ...[6, 7, 8].flatMap((index) =>
          branchEvents({ index, batchId: 'run-1', agentId: 'rebaser' }),
        ),
      ],
    });

    const titles = rowsOf(model).map((row) => row.title);

    expect(titles).toContain('Rebased 6 branches on main');
    expect(titles).toHaveLength(2);
  });

  it('gives each of two rebase runs its own row', () => {
    const model = modelOf({
      events: [
        request,
        ...many({ count: 3, batchId: 'run-a' }),
        ...[3, 4].flatMap((index) => branchEvents({ index, batchId: 'run-b', minuteOffset: 20 })),
      ],
    });

    expect(rowsOf(model).map((row) => row.title)).toEqual([
      'Rebased 2 branches',
      'Rebased 3 branches on main',
    ]);
  });

  it('says no base when the batch rebased onto different branches', () => {
    const other = eventOf({
      id: 'request-2',
      kind: 'rebase_requested',
      payload: { branch: 'develop' },
      createdAt: stamp({ minute: 1, second: 0 }),
    });
    const model = modelOf({ events: [request, other, ...many({ count: 3, batchId: 'run-1' })] });

    expect(rowsOf(model)[0]?.title).toBe('Rebased 3 branches');
  });
});
