// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type SessionEvent } from '@goodboy/types';
import { at, eventOf } from '../central/done/testing/doneFixtures';
import { historyBatchByEventIdOf, type HistoryBatch } from './historyBatchesOf';

type BatchesParams = {
  readonly events: ReadonlyArray<SessionEvent>;
};

const historyBatchesOf = ({ events }: BatchesParams): ReadonlyArray<HistoryBatch> =>
  Array.from(new Set(historyBatchByEventIdOf({ events }).values()));
import {
  historyBatchBaseOf,
  historyBatchBranchFactOf,
  historyBatchFactsOf,
  historyBatchSubOf,
  historyBatchTitleOf,
} from './historyBatchText';

const atSecond = ({ minute, second }: { readonly minute: number; readonly second: number }) =>
  brandId<IsoDateTime>({ value: new Date(2026, 9, 18, 9, minute, second).toISOString() });

type StepParams = {
  readonly id: string;
  readonly branch: string;
  readonly minute: number;
  readonly origin?: 'rebase' | 'plan';
  readonly batchId?: string;
  readonly prNumber?: number;
  readonly isPushed?: boolean;
};

const stepEvents = ({
  id,
  branch,
  minute,
  origin = 'rebase',
  batchId,
  prNumber,
  isPushed = true,
}: StepParams): ReadonlyArray<SessionEvent> => {
  const payload = {
    origin,
    branch,
    mountId: `mount-${branch}`,
    projectName: branch.split('/')[0] ?? branch,
    ...(batchId === undefined ? {} : { batchId }),
  };
  return [
    eventOf({
      id: `${id}-rewrite`,
      kind: 'history_rewritten',
      payload,
      createdAt: atSecond({ minute, second: 0 }),
    }),
    ...(isPushed
      ? [
          eventOf({
            id: `${id}-push`,
            kind: 'history_pushed',
            payload: { ...payload, ...(prNumber === undefined ? {} : { prNumber }) },
            createdAt: atSecond({ minute, second: 20 }),
          }),
        ]
      : []),
  ];
};

const nine = ({ batchId }: { readonly batchId?: string }): ReadonlyArray<SessionEvent> =>
  Array.from({ length: 9 }, (_, index) =>
    stepEvents({
      id: `b${index}`,
      branch: `branch-${index}`,
      minute: index,
      ...(batchId === undefined ? {} : { batchId }),
      ...(index < 3 ? { prNumber: 300 + index } : {}),
    }),
  ).flat();

describe('historyBatchesOf', () => {
  it('groups the events that share a batch key into one batch of nine branches', () => {
    const batches = historyBatchesOf({ events: nine({ batchId: 'run-1' }) });

    expect(batches).toHaveLength(1);
    expect(batches[0]?.key).toBe('rebase:run-1');
    expect(batches[0]?.branches).toHaveLength(9);
    expect(batches[0]?.events).toHaveLength(18);
  });

  it('keeps two rebase runs apart even when they overlap in time', () => {
    const first = [
      ...stepEvents({ id: 'a1', branch: 'ledger-core/one', minute: 0, batchId: 'run-a' }),
      ...stepEvents({ id: 'a2', branch: 'ledger-core/two', minute: 1, batchId: 'run-a' }),
    ];
    const second = [
      ...stepEvents({ id: 'b1', branch: 'notify-relay/one', minute: 0, batchId: 'run-b' }),
      ...stepEvents({ id: 'b2', branch: 'notify-relay/two', minute: 1, batchId: 'run-b' }),
    ];

    const keys = historyBatchesOf({ events: [...first, ...second] }).map((batch) => batch.key);

    expect(keys.sort()).toEqual(['rebase:run-a', 'rebase:run-b']);
  });

  it('groups legacy events without a key by origin and a two minute window', () => {
    const batches = historyBatchesOf({ events: nine({}) });

    expect(batches).toHaveLength(1);
    expect(batches[0]?.branches).toHaveLength(9);
    expect(batches[0]?.key.startsWith('window:rebase:')).toBe(true);
  });

  it('splits legacy events when the gap is longer than the window', () => {
    const events = [
      ...stepEvents({ id: 'a1', branch: 'ledger-core/one', minute: 0 }),
      ...stepEvents({ id: 'a2', branch: 'ledger-core/two', minute: 1 }),
      ...stepEvents({ id: 'b1', branch: 'notify-relay/one', minute: 30 }),
      ...stepEvents({ id: 'b2', branch: 'notify-relay/two', minute: 31 }),
    ];

    expect(historyBatchesOf({ events }).map((batch) => batch.branches.length)).toEqual([2, 2]);
  });

  it('does not fold one branch, rewritten and pushed', () => {
    const events = stepEvents({ id: 'solo', branch: 'payments-api/solo', minute: 0 });

    expect(historyBatchesOf({ events })).toEqual([]);
  });

  it('never mixes origins in one legacy batch', () => {
    const events = [
      ...stepEvents({ id: 'r1', branch: 'ledger-core/one', minute: 0 }),
      ...stepEvents({ id: 'p1', branch: 'notify-relay/one', minute: 0, origin: 'plan' }),
    ];

    expect(historyBatchesOf({ events })).toEqual([]);
  });

  it('folds a batch of pushes that no rebase caused', () => {
    const events = [
      ...stepEvents({ id: 'p1', branch: 'ledger-core/one', minute: 0, origin: 'plan' }),
      ...stepEvents({ id: 'p2', branch: 'notify-relay/one', minute: 1, origin: 'plan' }),
      ...stepEvents({ id: 'p3', branch: 'payments-api/one', minute: 1, origin: 'plan' }),
    ];

    const [batch] = historyBatchesOf({ events });

    expect(batch?.origin).toBe('plan');
    expect(batch?.branches).toHaveLength(3);
  });

  it('keeps keyed and legacy events of one session in separate batches', () => {
    const keyed = [
      ...stepEvents({ id: 'k1', branch: 'ledger-core/one', minute: 0, batchId: 'run-k' }),
      ...stepEvents({ id: 'k2', branch: 'ledger-core/two', minute: 1, batchId: 'run-k' }),
    ];
    const legacy = [
      ...stepEvents({ id: 'l1', branch: 'notify-relay/one', minute: 1 }),
      ...stepEvents({ id: 'l2', branch: 'notify-relay/two', minute: 2 }),
    ];

    const batches = historyBatchesOf({ events: [...keyed, ...legacy] });

    expect(batches.map((batch) => batch.events.length)).toEqual([4, 4]);
    expect(batches.map((batch) => batch.key).some((key) => key === 'rebase:run-k')).toBe(true);
  });

  it('ignores events that are not history rewrites or pushes', () => {
    const events = [
      eventOf({ id: 'x1', kind: 'branch_switched', payload: { origin: 'rebase' } }),
      eventOf({ id: 'x2', kind: 'history_stopped', payload: { origin: 'rebase' } }),
    ];

    expect(historyBatchesOf({ events })).toEqual([]);
  });

  it('points the entry of a batch at its newest event', () => {
    const events = nine({ batchId: 'run-1' });
    const [batch] = historyBatchesOf({ events });

    expect(batch?.entryId).toBe('event:b8-push');
    expect(historyBatchByEventIdOf({ events }).get('b0-rewrite')?.entryId).toBe('event:b8-push');
  });
});

describe('historyBatchText', () => {
  const batch = historyBatchesOf({ events: nine({ batchId: 'run-1' }) })[0];

  it('says one short title and one sub line from one set of counts', () => {
    const facts = historyBatchFactsOf({ branches: batch?.branches ?? [] });

    expect(facts).toEqual({ branchCount: 9, rewrittenCount: 9, pushedCount: 9, prCount: 3 });
    expect(historyBatchTitleOf({ origin: 'rebase', facts, base: 'main' })).toBe(
      'Rebased 9 branches on main',
    );
    expect(historyBatchSubOf({ origin: 'rebase', facts })).toBe(
      'Rebase all · 9 pushed, 3 PRs updated',
    );
  });

  it('drops the base when there is none and the parts that are zero', () => {
    const facts = { branchCount: 2, rewrittenCount: 2, pushedCount: 1, prCount: 1 };

    expect(historyBatchTitleOf({ origin: 'rebase', facts, base: null })).toBe('Rebased 2 branches');
    expect(historyBatchSubOf({ origin: 'rebase', facts })).toBe(
      'Rebase all · 1 pushed, 1 PR updated',
    );
    expect(
      historyBatchSubOf({ origin: 'rebase', facts: { ...facts, pushedCount: 0, prCount: 0 } }),
    ).toBe('Rebase all');
  });

  it('titles a batch of pushes and a batch of rewrites by what they did', () => {
    const pushes = { branchCount: 3, rewrittenCount: 0, pushedCount: 3, prCount: 0 };
    const rewrites = { branchCount: 3, rewrittenCount: 3, pushedCount: 3, prCount: 2 };

    expect(historyBatchTitleOf({ origin: 'plan', facts: pushes, base: null })).toBe(
      'Pushed the new history of 3 branches',
    );
    expect(historyBatchTitleOf({ origin: 'plan', facts: rewrites, base: null })).toBe(
      'Rewrote 3 branches',
    );
  });

  it('says what happened to each branch', () => {
    const first = batch?.branches[0];
    const last = batch?.branches.at(-1);
    const unpushed = historyBatchesOf({
      events: [
        ...stepEvents({ id: 'u1', branch: 'ledger-core/a', minute: 0, isPushed: false }),
        ...stepEvents({ id: 'u2', branch: 'ledger-core/b', minute: 1, isPushed: false }),
      ],
    })[0]?.branches[0];

    expect(
      first === undefined ? '' : historyBatchBranchFactOf({ branch: first, origin: 'rebase' }),
    ).toBe('Pushed · PR #300 updated');
    expect(
      last === undefined ? '' : historyBatchBranchFactOf({ branch: last, origin: 'rebase' }),
    ).toBe('Pushed');
    expect(
      unpushed === undefined
        ? ''
        : historyBatchBranchFactOf({ branch: unpushed, origin: 'rebase' }),
    ).toBe('Rebased, not pushed');
  });

  it('reads the base only when every rebase of the batch had the same one', () => {
    const events = nine({ batchId: 'run-1' });
    const request = (id: string, base: string) =>
      eventOf({
        id,
        kind: 'rebase_requested',
        payload: { branch: base },
        createdAt: at({ hour: 9, minute: 0 }),
      });
    const target = historyBatchesOf({ events })[0];

    expect(
      target === undefined
        ? null
        : historyBatchBaseOf({
            batch: target,
            events: [...events, request('q1', 'main'), request('q2', 'main')],
          }),
    ).toBe('main');
    expect(
      target === undefined
        ? 'x'
        : historyBatchBaseOf({
            batch: target,
            events: [...events, request('q1', 'main'), request('q2', 'develop')],
          }),
    ).toBeNull();
  });
});
