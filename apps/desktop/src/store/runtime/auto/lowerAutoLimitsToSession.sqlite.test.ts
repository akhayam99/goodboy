import { describe, expect, it } from 'vitest';
import { AUTO_BLOCK_TEXT } from '@goodboy/core';
import { getAutoTree } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type SessionId } from '@goodboy/types';
import { lowerAutoLimitsToSession } from './lowerAutoLimitsToSession';
import { makeRuntimeWorld, userSays, type RuntimeWorld } from './testing/runtimeWorld';

const SESSION_ID = brandId<SessionId>({ value: AUTO_SEED_SESSION });

type LowerParams = {
  readonly world: RuntimeWorld;
  readonly capUsd: number;
};

const lower = ({ world, capUsd }: LowerParams) =>
  lowerAutoLimitsToSession({
    db: world.state.world.db,
    sessionId: SESSION_ID,
    capUsd,
    nowMs: world.state.world.clock.now(),
    drive: async ({ treeId }) => {
      await world.runtime.drive(treeId);
      await world.runtime.settled();
    },
    onDriveError: ({ error }) => {
      world.errors.push(error);
    },
  });

const treeOf = (world: RuntimeWorld) =>
  getAutoTree({ db: world.state.world.db, treeId: world.treeId });

describe('the smallest limit pauses a running Auto', () => {
  it('pauses a running Auto at its spend once the session limit drops under its own', async () => {
    const world = await makeRuntimeWorld({ capUsd: 5 });

    expect(await lower({ world, capUsd: 0.2 })).toEqual([world.treeId]);
    await userSays({ world, id: 'outbox-user-1', text: 'Fix the dev server' });

    expect(await treeOf(world)).toMatchObject({
      capUsd: 0.2,
      phase: 'blocked',
      blockedReason: AUTO_BLOCK_TEXT.budget,
    });
    expect(world.state.ports.autoTurns).toHaveLength(0);
    expect(world.errors).toEqual([]);
  });

  it('keeps a smaller Auto limit when the session limit is larger', async () => {
    const world = await makeRuntimeWorld({ capUsd: 5 });

    expect(await lower({ world, capUsd: 8 })).toEqual([]);

    expect((await treeOf(world))?.capUsd).toBe(5);
  });

  it('leaves a finished Auto as it ended', async () => {
    const world = await makeRuntimeWorld({ capUsd: 5 });
    await world.state.world.db.execute(`UPDATE auto_trees SET phase = 'finished'`);

    expect(await lower({ world, capUsd: 1 })).toEqual([]);

    expect((await treeOf(world))?.capUsd).toBe(5);
  });
});
