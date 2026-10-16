import { describe, expect, it } from 'vitest';
import { autoBudgetOf } from '@goodboy/core';
import { getAutoTree, readAutoTreeSpend } from '@goodboy/db';
import { setAutoTreeCap } from './setAutoTreeCap';
import { makeRuntimeWorld, userSays, type RuntimeWorld } from './testing/runtimeWorld';

type RaiseParams = {
  readonly world: RuntimeWorld;
  readonly expectedCapUsd: number | null;
  readonly capUsd: number | null;
};

const raise = ({ world, expectedCapUsd, capUsd }: RaiseParams) =>
  setAutoTreeCap({
    db: world.state.world.db,
    treeId: world.treeId,
    expectedCapUsd,
    capUsd,
    nowMs: world.state.world.clock.now(),
    drive: async ({ treeId }) => {
      await world.runtime.drive(treeId);
      await world.runtime.settled();
    },
    onDriveError: (error) => {
      world.errors.push(error);
    },
  });

describe('changing the Auto limit of a running conversation', () => {
  it('resumes a tree paused at the limit once the limit is raised', async () => {
    const world = await makeRuntimeWorld({ capUsd: 0.2 });
    await userSays({ world, id: 'outbox-user-1', text: 'Fix the dev server' });
    expect(await getAutoTree({ db: world.state.world.db, treeId: world.treeId })).toMatchObject({
      phase: 'blocked',
    });
    expect(world.state.ports.autoTurns).toHaveLength(0);

    const outcome = await raise({ world, expectedCapUsd: 0.2, capUsd: 10 });

    expect(outcome).toEqual({ kind: 'applied' });
    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect(await getAutoTree({ db: world.state.world.db, treeId: world.treeId })).toMatchObject({
      phase: 'deciding',
      capUsd: 10,
    });
    expect(world.errors).toEqual([]);
  });

  it('keeps the value another window wrote and drives nothing', async () => {
    const world = await makeRuntimeWorld({ capUsd: 5 });
    expect(await raise({ world, expectedCapUsd: 5, capUsd: 8 })).toEqual({ kind: 'applied' });
    expect(await raise({ world, expectedCapUsd: 5, capUsd: 20 })).toEqual({
      kind: 'stale',
      capUsd: 8,
    });
    expect((await getAutoTree({ db: world.state.world.db, treeId: world.treeId }))?.capUsd).toBe(8);
  });

  it('refuses an amount that is not more than zero before it writes', async () => {
    const world = await makeRuntimeWorld({ capUsd: 5 });
    await expect(raise({ world, expectedCapUsd: 5, capUsd: 0 })).rejects.toThrow(
      'The limit must be more than zero',
    );
    expect((await getAutoTree({ db: world.state.world.db, treeId: world.treeId }))?.capUsd).toBe(5);
  });

  it('starts a turn paused at the old limit once the cap is removed', async () => {
    const world = await makeRuntimeWorld({ capUsd: 0.2 });
    await userSays({ world, id: 'outbox-user-1', text: 'Fix the dev server' });
    expect(world.state.ports.autoTurns).toHaveLength(0);

    expect(await raise({ world, expectedCapUsd: 0.2, capUsd: null })).toEqual({ kind: 'applied' });

    expect(world.state.ports.autoTurns).toHaveLength(1);
    const tree = await getAutoTree({ db: world.state.world.db, treeId: world.treeId });
    expect(tree).toMatchObject({ phase: 'deciding', capUsd: null });
    expect(world.state.ports.autoTurns.at(-1)?.text ?? '').toContain(
      'Budget for this conversation: no cap.',
    );
    expect(world.state.ports.autoTurns.at(-1)?.text ?? '').not.toContain('Left');
  });

  it('keeps No cap after a restart and puts a limit back from it', async () => {
    const world = await makeRuntimeWorld({ capUsd: 5 });
    await raise({ world, expectedCapUsd: 5, capUsd: null });
    const spend = await readAutoTreeSpend({ db: world.state.world.db, treeId: world.treeId });
    expect(spend === null ? null : autoBudgetOf({ spend })).toMatchObject({
      capUsd: null,
      remainingUsd: null,
    });
    expect(await raise({ world, expectedCapUsd: null, capUsd: 7 })).toEqual({ kind: 'applied' });
    expect((await getAutoTree({ db: world.state.world.db, treeId: world.treeId }))?.capUsd).toBe(7);
  });

  it('reads the same left after a reserve, a raise and the next delivery line', async () => {
    const world = await makeRuntimeWorld({ capUsd: 5 });
    await userSays({ world, id: 'outbox-user-1', text: 'Fix the dev server' });
    const before = await readAutoTreeSpend({ db: world.state.world.db, treeId: world.treeId });
    expect(before === null ? null : autoBudgetOf({ spend: before })).toMatchObject({
      capUsd: 5,
      reservedUsd: 0.5,
      remainingUsd: 4.5,
    });
    await raise({ world, expectedCapUsd: 5, capUsd: 10 });
    const after = await readAutoTreeSpend({ db: world.state.world.db, treeId: world.treeId });
    expect(after === null ? null : autoBudgetOf({ spend: after })).toMatchObject({
      capUsd: 10,
      reservedUsd: 0.5,
      remainingUsd: 9.5,
    });
  });
});
