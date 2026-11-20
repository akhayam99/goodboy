import { describe, expect, it } from 'vitest';
import { AUTO_BLOCK_TEXT, LEGACY_GATE_TEXTS } from '@goodboy/core/auto';
import { getAutoTree } from '@goodboy/db';
import { setAutoTreeCap } from './setAutoTreeCap';
import {
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const treeOf = (world: RuntimeWorld) =>
  getAutoTree({ db: world.state.world.db, treeId: world.treeId });

type BlockParams = {
  readonly reason: string;
  readonly capUsd?: number;
};

const blockedWith = async ({ reason, capUsd = 10 }: BlockParams): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd });
  await userSays({ world, id: 'outbox-user-1', text: 'Keep going' });
  await world.runtime.settled();
  await world.state.world.db.execute(
    `UPDATE auto_trees SET phase = 'blocked', blocked_reason = ?, active_run_id = NULL, active_delivery_id = NULL`,
    [reason],
  );
  return world;
};

const STORED_TEXTS = [
  LEGACY_GATE_TEXTS.noProgress,
  LEGACY_GATE_TEXTS.budget,
  LEGACY_GATE_TEXTS.returns,
  LEGACY_GATE_TEXTS.timeLimit,
  `${LEGACY_GATE_TEXTS.refusedPrefix} and was refused: the plan isn't approved yet. Retry to let it choose again, or tell it what to change.`,
];

describe('a Lead blocked by a text an older version wrote', () => {
  it.each(STORED_TEXTS)('stays blocked across a restart without a retry: %s', async (reason) => {
    const world = await blockedWith({ reason });
    const turnsBefore = world.state.ports.autoTurns.length;

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(await treeOf(world)).toMatchObject({ phase: 'blocked', blockedReason: reason });
    expect(restarted.state.ports.autoTurns).toHaveLength(0);
    expect(world.state.ports.autoTurns).toHaveLength(turnsBefore);
  });

  it('resumes once the limit is raised when it was blocked at the old spend limit text', async () => {
    const world = await makeRuntimeWorld({ capUsd: 0.2 });
    await userSays({ world, id: 'outbox-user-1', text: 'Fix the dev server' });
    await world.state.world.db.execute(`UPDATE auto_trees SET blocked_reason = ?`, [
      LEGACY_GATE_TEXTS.budget,
    ]);
    expect(world.state.ports.autoTurns).toHaveLength(0);

    const outcome = await setAutoTreeCap({
      db: world.state.world.db,
      treeId: world.treeId,
      expectedCapUsd: 0.2,
      capUsd: 10,
      nowMs: world.state.world.clock.now(),
      drive: async ({ treeId }) => {
        await world.runtime.drive(treeId);
        await world.runtime.settled();
      },
      onDriveError: (error) => {
        world.errors.push(error);
      },
    });

    expect(outcome).toEqual({ kind: 'applied' });
    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', blockedReason: null });
  });

  it('leaves a tree blocked at the old returns text for Retry and resumes on Retry', async () => {
    const world = await blockedWith({ reason: LEGACY_GATE_TEXTS.returns });
    for (let index = 0; index < 5; index += 1) {
      await world.runtime.drive(world.treeId);
    }
    await world.runtime.settled();
    expect(await treeOf(world)).toMatchObject({
      phase: 'blocked',
      blockedReason: LEGACY_GATE_TEXTS.returns,
    });

    expect((await world.runtime.retry(world.treeId)).kind).toBe('retried');
    await world.runtime.settled();

    expect((await treeOf(world))?.blockedReason).toBeNull();
  });

  it('writes the new words for a block today', async () => {
    const world = await makeRuntimeWorld({ capUsd: 0.1 });
    await userSays({ world, id: 'outbox-user-1', text: 'Keep going' });

    expect((await treeOf(world))?.blockedReason).toBe(AUTO_BLOCK_TEXT.budget);
  });
});
