import { describe, expect, it } from 'vitest';
import { autoBudgetFacts, autoBudgetLabel, autoBudgetPromptLine } from '@goodboy/core';
import { listAutoReservations } from '@goodboy/db';
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
      settledUsd: 1.6,
      reservedUsd: 0.75,
      remainingUsd: 2.65,
      estimatedUsd: 0.5,
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
    const facts = autoBudgetFacts({ spend });
    expect(budget?.facts).toEqual(facts);
    expect(budget?.label).toBe(autoBudgetLabel({ facts }));
    expect(budget?.promptLine).toBe(autoBudgetPromptLine({ facts }));
    expect(budget?.label).toBe('2.40 USD of 5.00 USD');
    expect(budget?.promptLine).toContain('Left 2.60 USD.');

    await startNewTurn({ world, expectedPhaseRev: 3, from: ['delegating'] });
    const next = await world.scheduler.admit(
      batchInput({
        requestId: 'request-2',
        children: [childInput({ key: 'b', role: 'implementer' })],
      }),
    );
    expect(next.kind === 'accepted' ? next.receipt.delegations[0]?.ceilingUsd : null).toBe(
      Math.min(3, facts.remainingUsd),
    );
  });

  it('counts an unknown cost at its ceiling and says it is an estimate', async () => {
    const world = await makeAutoWorld();
    await world.scheduler.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    await run({ world, key: 'a' });
    await settle({ world, key: 'a', costUsd: null });
    const budget = await world.scheduler.budget({ treeId: WORLD_TREE });
    expect(budget?.facts).toMatchObject({ spentUsd: 0.5, hasEstimate: true });
    expect(budget?.label).toBe('0.50 USD of 5.00 USD, estimated');
  });

  it('reads nothing for a tree that does not exist', async () => {
    const world = await makeAutoWorld();
    expect(
      await world.scheduler.budget({ treeId: brandId<AutoTreeId>({ value: 'tree-none' }) }),
    ).toBeNull();
  });
});

describe('a bound, not a threshold', () => {
  it('admits what the cap holds, refuses the rest, and frees budget as attempts settle cheaper', async () => {
    const world = await makeAutoWorld({ capUsd: 1 });
    const four = ['a', 'b', 'c', 'd'].map((key) => childInput({ key }));
    const refused = await world.scheduler.admit(batchInput({ children: four }));
    expect(refused).toMatchObject({ kind: 'refused', code: 'budget' });
    const fits = await world.scheduler.admit(
      batchInput({ requestId: 'request-2', children: four.slice(0, 2) }),
    );
    expect(fits.kind).toBe('accepted');
    expect((await treeSpend({ db: world.db, treeId: WORLD_TREE }))?.remainingUsd).toBe(0);
    for (const key of ['a', 'b']) {
      await run({ world, key });
      await settle({ world, key, costUsd: 0.1 });
    }
    expect(await treeSpend({ db: world.db, treeId: WORLD_TREE })).toMatchObject({
      settledUsd: 0.2,
      reservedUsd: 0,
      remainingUsd: 0.8,
    });
    await startNewTurn({ world, expectedPhaseRev: 4, from: ['delegating'] });
    const again = await world.scheduler.admit(
      batchInput({
        requestId: 'request-3',
        children: [childInput({ key: 'c' }), childInput({ key: 'd' })],
      }),
    );
    expect(again.kind).toBe('accepted');
  });
});
