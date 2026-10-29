import { describe, expect, it } from 'vitest';
import { AUTO_STALE_DECIDE_MS } from '@goodboy/core';
import { getAutoTree, listAutoDelegations, listAutoOutbox } from '@goodboy/db';
import { settleAutoTurn } from './settleAutoTurn';
import { endedTurn } from './testing/deliveryWorld';
import {
  autoBlockText,
  autoTurnEndsWithBlock,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const BLOCK = {
  action: 'delegate',
  requestId: 'r30',
  children: [
    {
      role: 'implementer',
      mount: 'mount-ledger-core',
      title: 'Split the export into clusters',
      difficulty: 'heavy',
      task: 'name each branch <type>/<kebab-desc> and keep the union equal to the source tree',
      reason: 'a code change',
    },
  ],
};

const started = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'split the ledger export branch' });
  return world;
};

const treeOf = (world: RuntimeWorld) =>
  getAutoTree({ db: world.state.world.db, treeId: world.treeId });

const delegationsOf = (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const refusalsOf = async (world: RuntimeWorld) =>
  (await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })).filter(
    (row) => row.kind === 'refusal',
  );

const currentTurn = (world: RuntimeWorld) => {
  const turn = world.state.ports.autoTurns.at(-1);
  if (turn === undefined) {
    throw new Error('an Auto turn was expected');
  }
  return turn;
};

describe('a recovery tick while the turn of this window is still saving its answer', () => {
  it('leaves the turn to its own end, so the block of the answer is admitted', async () => {
    const world = await started();
    const turn = currentTurn(world);
    world.state.ports.liveRuns.delete(turn.runId);
    world.state.ports.runOutcomes.set(turn.runId, { assistantText: '', exit: 'ok', costUsd: 0.1 });

    await world.runtime.recover(world.treeId);
    await world.runtime.settled();
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', activeRunId: turn.runId });

    await autoTurnEndsWithBlock({ world, block: BLOCK });

    expect((await delegationsOf(world)).map((row) => row.requestId)).toEqual(['r30']);
    expect(await treeOf(world)).toMatchObject({ phase: 'waiting', activeRunId: null });
    expect(await refusalsOf(world)).toHaveLength(0);
    expect(world.errors).toEqual([]);
  });

  it('does not expire a turn of this window past the stale threshold while it saves its answer', async () => {
    const world = await started();
    const turn = currentTurn(world);
    world.state.ports.liveRuns.delete(turn.runId);
    world.state.ports.runOutcomes.set(turn.runId, { assistantText: '', exit: 'ok', costUsd: 0.1 });
    world.state.world.clock.advance({ ms: AUTO_STALE_DECIDE_MS + 1_000 });

    await world.runtime.recover(world.treeId);
    await world.runtime.settled();
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', activeRunId: turn.runId });

    await autoTurnEndsWithBlock({ world, block: BLOCK });

    expect((await delegationsOf(world)).map((row) => row.requestId)).toEqual(['r30']);
    expect(await refusalsOf(world)).toHaveLength(0);
    expect(world.errors).toEqual([]);
  });

  it('still settles a turn that a runtime of an earlier process started', async () => {
    const world = await started();
    const turn = currentTurn(world);
    const restarted = restartedWorld({ world });
    restarted.state.ports.liveRuns.delete(turn.runId);
    restarted.state.ports.runOutcomes.set(turn.runId, {
      assistantText: autoBlockText(BLOCK),
      exit: 'ok',
      costUsd: 0.1,
    });

    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect((await delegationsOf(restarted)).map((row) => row.requestId)).toEqual(['r30']);
  });
});

describe('a delegate block that arrives after its turn was settled without it', () => {
  it('stores a refusal the user and Auto can read, and admits nothing', async () => {
    const world = await started();
    const turn = currentTurn(world);

    await settleAutoTurn({
      ctx: world.state.ctx,
      ended: endedTurn({ runId: turn.runId, deliveryId: turn.deliveryId, assistantText: '' }),
    });
    expect(await treeOf(world)).toMatchObject({ phase: 'answering', activeRunId: null });

    turn.onEnded(
      endedTurn({
        runId: turn.runId,
        deliveryId: turn.deliveryId,
        assistantText: `Handing this over.\n\n${autoBlockText(BLOCK)}`,
      }),
    );
    await world.runtime.settled();

    expect(await delegationsOf(world)).toHaveLength(0);
    const refusals = await refusalsOf(world);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]?.payload).toMatchObject({
      kind: 'refusal',
      action: 'delegate',
      code: 'not_deciding',
      roles: ['implementer'],
    });
    expect(world.errors).toEqual([]);
  });

  it('stores nothing when the same block was already admitted', async () => {
    const world = await started();
    const turn = currentTurn(world);
    const ended = endedTurn({
      runId: turn.runId,
      deliveryId: turn.deliveryId,
      assistantText: autoBlockText(BLOCK),
    });

    turn.onEnded(ended);
    await world.runtime.settled();
    turn.onEnded(ended);
    await world.runtime.settled();

    expect(await delegationsOf(world)).toHaveLength(1);
    expect(await refusalsOf(world)).toHaveLength(0);
  });
});

describe('a message of the user that arrives while Auto decides', () => {
  it('waits for the turn and keeps the block of that turn', async () => {
    const world = await started();
    const turn = currentTurn(world);

    await userSays({ world, id: 'outbox-user-2', text: 'are you doing anything?' });
    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', activeRunId: turn.runId });

    await autoTurnEndsWithBlock({ world, block: BLOCK });

    expect((await delegationsOf(world)).map((row) => row.requestId)).toEqual(['r30']);
    expect(await refusalsOf(world)).toHaveLength(0);
  });
});
