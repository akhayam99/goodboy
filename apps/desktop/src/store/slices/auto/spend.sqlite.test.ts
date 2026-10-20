import { describe, expect, it } from 'vitest';
import { autoBudgetOf, autoBudgetLabel, autoBudgetPromptLine } from '@goodboy/core';
import { getAutoTree, listAutoReservations, setAutoTreeCapIfUnchanged } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import {
  brandId,
  type AutoAttemptId,
  type AutoDelegationId,
  type AutoTreeId,
} from '@goodboy/types';
import { treeSpend } from './spend';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  startNewTurn,
  WORLD_NOW,
  WORLD_TREE,
  type AutoWorld,
} from './testing/autoWorld';

type StartParams = {
  readonly world: AutoWorld;
  readonly key: string;
};

const run = async ({ world, key }: StartParams): Promise<void> => {
  await world.scheduler.startAttempt({
    treeId: WORLD_TREE,
    delegationId: brandId<AutoDelegationId>({ value: `delegation-${key}` }),
    generation: 1,
    baseline: null,
    writeSet: null,
  });
  await world.scheduler.markAttemptRunning({
    attemptId: brandId<AutoAttemptId>({ value: `attempt-${key}` }),
    delegationId: brandId<AutoDelegationId>({ value: `delegation-${key}` }),
    generation: 1,
    runId: `run-${key}`,
  });
};

type SettleParams = {
  readonly world: AutoWorld;
  readonly key: string;
  readonly costUsd: number | null;
};

const settle = ({ world, key, costUsd }: SettleParams) =>
  world.scheduler.settleAttempt({
    attemptId: brandId<AutoAttemptId>({ value: `attempt-${key}` }),
    generation: 1,
    ending: { kind: 'ended', outcome: 'completed', endReason: 'ok', costUsd, resultSnapshot: null },
  });

type RequireSpendParams = {
  readonly world: AutoWorld;
};

const requireSpend = async ({ world }: RequireSpendParams) => {
  const spend = await treeSpend({ db: world.db, treeId: WORLD_TREE });
  if (spend === null) {
    throw new Error('The tree is missing');
  }
  return spend;
};

type SpendLiveParams = {
  readonly world: AutoWorld;
  readonly key: string;
  readonly usd: number;
};

const spendLive = async ({ world, key, usd }: SpendLiveParams): Promise<void> => {
  const runId = `run-${key}`;
  await world.db.execute(
    `INSERT OR IGNORE INTO provider_runs
      (id, session_id, provider, model, status_kind, status_payload, created_at)
     VALUES (?, ?, 'anthropic', 'claude-sonnet-5-5', 'succeeded', '{}', ?)`,
    [runId, AUTO_SEED_SESSION, WORLD_NOW],
  );
  await world.db.execute(
    `INSERT INTO telemetry_records
      (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens,
       estimated_cost_usd, recorded_at)
     VALUES (?, ?, ?, 'turn', 'anthropic', 'claude-sonnet-5-5', 1, 1, ?, ?)`,
    [`telemetry-${key}-${usd}`, runId, AUTO_SEED_SESSION, usd, WORLD_NOW],
  );
};

type NextTurnParams = {
  readonly world: AutoWorld;
};

const nextTurn = async ({ world }: NextTurnParams) => {
  const tree = await getAutoTree({ db: world.db, treeId: WORLD_TREE });
  return startNewTurn({ world, expectedPhaseRev: tree?.phaseRev ?? 0, from: ['delegating'] });
};

const sumOf = (rows: ReadonlyArray<{ readonly value: number }>): number =>
  rows.reduce((sum, row) => sum + row.value, 0);

describe('treeSpend', () => {
  it('equals the sum of the reservation rows, whatever state each is in', async () => {
    const world = await makeAutoWorld({ capUsd: 5 });
    await world.scheduler.admit(
      batchInput({
        children: [
          childInput({ key: 'a', role: 'implementer' }),
          childInput({ key: 'b' }),
          childInput({ key: 'c', role: 'planner' }),
        ],
      }),
    );
    for (const key of ['a', 'b']) {
      await run({ world, key });
    }
    await settle({ world, key: 'a', costUsd: 1.1 });
    await settle({ world, key: 'b', costUsd: null });
    const rows = await listAutoReservations({ db: world.db, treeId: WORLD_TREE });
    const spend = await treeSpend({ db: world.db, treeId: WORLD_TREE });
    expect(spend?.settledUsd).toBeCloseTo(
      sumOf(
        rows
          .filter((row) => row.state === 'reconciled')
          .map((row) => ({ value: row.actualUsd ?? 0 })),
      ),
      9,
    );
    expect(spend?.reservedUsd).toBeCloseTo(
      sumOf(
        rows.filter((row) => row.state === 'reserved').map((row) => ({ value: row.reservedUsd })),
      ),
      9,
    );
    expect(spend).toMatchObject({
      settledUsd: 1.1,
      liveUsd: 0,
      reservedUsd: 0,
      remainingUsd: 3.9,
      estimatedUsd: 0,
    });
  });

  it('is the same number in admission, in the prompt and on the screen', async () => {
    const world = await makeAutoWorld({ capUsd: 5 });
    await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a', role: 'implementer' })] }),
    );
    await run({ world, key: 'a' });
    await settle({ world, key: 'a', costUsd: 2.4 });
    const spend = await requireSpend({ world });
    const budget = await world.scheduler.budget({ treeId: WORLD_TREE });
    const facts = autoBudgetOf({ spend });
    expect(budget?.facts).toEqual(facts);
    expect(budget?.label).toBe(autoBudgetLabel({ facts }));
    expect(budget?.promptLine).toBe(autoBudgetPromptLine({ facts, turnReservedUsd: 0 }));
    expect(budget?.label).toBe('2.40 USD of 5.00 USD');
    expect(budget?.promptLine).toContain('Left 2.60 USD.');

    await startNewTurn({ world, expectedPhaseRev: 3, from: ['delegating'] });
    const next = await world.scheduler.admit(
      batchInput({
        requestId: 'request-2',
        children: [childInput({ key: 'b', role: 'implementer' })],
      }),
    );
    expect(next.kind).toBe('accepted');
    expect((await requireSpend({ world })).remainingUsd).toBeCloseTo(2.6, 9);
  });

  it('charges nothing it did not see when a child reports no cost, never a ceiling', async () => {
    const world = await makeAutoWorld();
    await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a', role: 'implementer' })] }),
    );
    await run({ world, key: 'a' });
    await settle({ world, key: 'a', costUsd: null });
    const budget = await world.scheduler.budget({ treeId: WORLD_TREE });
    expect(budget?.facts).toMatchObject({ spentUsd: 0, remainingUsd: 5 });
    const rows = await listAutoReservations({ db: world.db, treeId: WORLD_TREE });
    expect(rows[0]).toMatchObject({ state: 'reconciled', actualUsd: 0, isCostKnown: false });
  });

  it('counts what a running child spent so far as spent', async () => {
    const world = await makeAutoWorld({ capUsd: 50 });
    await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a', role: 'implementer' })] }),
    );
    await run({ world, key: 'a' });
    await spendLive({ world, key: 'a', usd: 4.25 });
    expect(await requireSpend({ world })).toMatchObject({
      settledUsd: 0,
      liveUsd: 4.25,
      reservedUsd: 0,
      remainingUsd: 45.75,
    });
    await settle({ world, key: 'a', costUsd: 4.25 });
    expect(await requireSpend({ world })).toMatchObject({
      settledUsd: 4.25,
      liveUsd: 0,
      remainingUsd: 45.75,
    });
  });

  it('reads an old reservation held for a running child as nothing held', async () => {
    const world = await makeAutoWorld({ capUsd: 5 });
    await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a', role: 'implementer' })] }),
    );
    await world.db.execute(
      `UPDATE auto_reservations SET reserved_usd = 3 WHERE tree_id = ? AND owner_kind = 'attempt'`,
      [WORLD_TREE],
    );
    expect(await requireSpend({ world })).toMatchObject({ reservedUsd: 0, remainingUsd: 5 });
    await run({ world, key: 'a' });
    await settle({ world, key: 'a', costUsd: null });
    expect(await requireSpend({ world })).toMatchObject({ settledUsd: 0, remainingUsd: 5 });
  });

  it('reads nothing for a tree that does not exist', async () => {
    const world = await makeAutoWorld();
    expect(
      await world.scheduler.budget({ treeId: brandId<AutoTreeId>({ value: 'tree-none' }) }),
    ).toBeNull();
  });
});

describe('real spend against the limit, no ceiling per child', () => {
  it('admits four implementers under a $1 limit, since nothing is held for them', async () => {
    const world = await makeAutoWorld({ capUsd: 1 });
    const four = ['a', 'b', 'c', 'd'].map((key) => childInput({ key, role: 'implementer' }));
    const admitted = await world.scheduler.admit(batchInput({ children: four }));
    expect(admitted.kind).toBe('accepted');
    expect(await requireSpend({ world })).toMatchObject({ reservedUsd: 0, remainingUsd: 1 });
  });

  it('lets a child that spends past $3 keep running and settle at what it spent', async () => {
    const world = await makeAutoWorld({ capUsd: 50 });
    await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a', role: 'implementer' })] }),
    );
    await run({ world, key: 'a' });
    await spendLive({ world, key: 'a', usd: 3.5 });
    await spendLive({ world, key: 'a', usd: 4 });
    const attempts = await world.db.select<{ readonly state: string }>(
      'SELECT state FROM auto_attempts WHERE id = ?',
      ['attempt-a'],
    );
    expect(attempts[0]?.state).toBe('running');
    await settle({ world, key: 'a', costUsd: 7.5 });
    expect(await requireSpend({ world })).toMatchObject({ settledUsd: 7.5, remainingUsd: 42.5 });
  });

  it('admits with no limit whatever the children spent', async () => {
    const world = await makeAutoWorld({ capUsd: 1 });
    await setAutoTreeCapIfUnchanged({
      db: world.db,
      treeId: WORLD_TREE,
      expectedCapUsd: 1,
      capUsd: null,
      nowMs: world.clock.now(),
    });
    await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a', role: 'implementer' })] }),
    );
    await run({ world, key: 'a' });
    await spendLive({ world, key: 'a', usd: 12 });
    await nextTurn({ world });
    const next = await world.scheduler.admit(
      batchInput({ requestId: 'request-2', children: [childInput({ key: 'b' })] }),
    );
    expect(next.kind).toBe('accepted');
    expect((await requireSpend({ world })).remainingUsd).toBeNull();
  });

  it('refuses a new child once real spend reaches the limit, and pauses the tree there', async () => {
    const world = await makeAutoWorld({ capUsd: 5 });
    await world.scheduler.admit(
      batchInput({ children: [childInput({ key: 'a', role: 'implementer' })] }),
    );
    await run({ world, key: 'a' });
    await spendLive({ world, key: 'a', usd: 5 });
    const budget = await world.scheduler.budget({ treeId: WORLD_TREE });
    expect(budget?.facts).toMatchObject({ spentUsd: 5, remainingUsd: 0 });
    await nextTurn({ world });
    const refused = await world.scheduler.admit(
      batchInput({ requestId: 'request-2', children: [childInput({ key: 'b' })] }),
    );
    expect(refused).toMatchObject({ kind: 'refused', code: 'budget' });
  });
});
