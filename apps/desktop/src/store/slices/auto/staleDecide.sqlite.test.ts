import { describe, expect, it } from 'vitest';
import {
  AUTO_BLOCK_TEXT,
  AUTO_MAX_GRANTS_PER_TREE,
  AUTO_STALE_DECIDE_MS,
  AUTO_STALE_DECIDE_TEXT,
  effectiveTreeLimits,
} from '@goodboy/core';
import { getAutoTree, listAutoOutbox, listAutoReservations } from '@goodboy/db';
import { makeRuntimeWorld, userSays, type RuntimeWorld } from './testing/runtimeWorld';

const treeOf = (world: RuntimeWorld) =>
  getAutoTree({ db: world.state.world.db, treeId: world.treeId });

const pendingOf = async (world: RuntimeWorld) =>
  listAutoOutbox({ db: world.state.world.db, treeId: world.treeId, states: ['pending'] });

const tick = async (world: RuntimeWorld): Promise<void> => {
  await world.runtime.drive(world.treeId);
  await world.runtime.settled();
};

const deciding = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world, id: 'outbox-user-1', text: 'Summarize the notify-relay retries' });
  return world;
};

const pastStale = (world: RuntimeWorld) =>
  world.state.world.clock.advance({ ms: AUTO_STALE_DECIDE_MS + 1_000 });

describe('a deciding tree whose Auto turn is gone', () => {
  it('stays deciding before the deadline, then blocks with a reason and keeps the message', async () => {
    const world = await deciding();
    world.state.world.clock.advance({ ms: AUTO_STALE_DECIDE_MS - 60_000 });
    await tick(world);
    expect((await treeOf(world))?.phase).toBe('deciding');

    world.state.world.clock.advance({ ms: 61_000 });
    await tick(world);

    expect(await treeOf(world)).toMatchObject({
      phase: 'blocked',
      blockedReason: AUTO_STALE_DECIDE_TEXT,
      activeRunId: null,
      activeDeliveryId: null,
    });
    const pending = await pendingOf(world);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.kind).toBe('user');
    expect(
      await listAutoReservations({ db: world.state.world.db, treeId: world.treeId }),
    ).toMatchObject([{ ownerKind: 'auto_turn', state: 'reconciled' }]);
    expect(world.state.ports.autoTurns).toHaveLength(1);
    expect(world.errors).toEqual([]);
  });

  it('leaves a turn that is still running alone, however long it takes', async () => {
    const world = await deciding();
    const runId = world.state.ports.autoTurns[0]?.runId ?? '';
    world.state.ports.liveRuns.add(runId);
    world.state.world.clock.advance({ ms: AUTO_STALE_DECIDE_MS * 3 });

    await tick(world);

    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', activeRunId: runId });
  });

  it('settles a turn that ended with an answer instead of blocking it', async () => {
    const world = await deciding();
    const runId = world.state.ports.autoTurns[0]?.runId ?? '';
    world.state.ports.runOutcomes.set(runId, {
      assistantText: 'The retries back off from 2s to 30s.',
      exit: 'ok',
      costUsd: 0.1,
    });
    pastStale(world);

    await tick(world);

    expect(await treeOf(world)).toMatchObject({ phase: 'answering', blockedReason: null });
    expect(await pendingOf(world)).toEqual([]);
  });

  it('redelivers the same message on Retry and decides again', async () => {
    const world = await deciding();
    pastStale(world);
    await tick(world);
    const firstText = world.state.ports.autoTurns[0]?.text ?? '';

    const outcome = await world.runtime.retry(world.treeId);
    await world.runtime.settled();

    expect(outcome).toEqual({ kind: 'retried', phase: 'merging' });
    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(world.state.ports.autoTurns[1]?.text).toContain('Summarize the notify-relay retries');
    expect(firstText).toContain('Summarize the notify-relay retries');
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', blockedReason: null });
    expect(await pendingOf(world)).toEqual([]);
  });

  it('retries when the user writes to the blocked tree', async () => {
    const world = await deciding();
    pastStale(world);
    await tick(world);

    const said = await world.runtime.say({ treeId: world.treeId, text: 'Try again please' });
    await world.runtime.settled();

    expect(said.kind).toBe('queued');
    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(world.state.ports.autoTurns[1]?.text).toContain('Try again please');
    expect((await treeOf(world))?.phase).toBe('deciding');
  });
});

describe('a blocked tree', () => {
  it('writes nothing while it stays blocked, however many ticks run', async () => {
    const world = await deciding();
    pastStale(world);
    await tick(world);
    const blocked = await treeOf(world);

    for (let index = 0; index < 20; index += 1) {
      world.state.world.clock.advance({ ms: 15_000 });
      await tick(world);
    }

    const after = await treeOf(world);
    expect(after?.phaseRev).toBe(blocked?.phaseRev);
    expect(after?.updatedAt).toBe(blocked?.updatedAt);
    expect(world.state.ports.autoTurns).toHaveLength(1);
  });

  it('stays put at the no progress limit with a message waiting', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await world.state.world.db.execute(
      `UPDATE auto_trees SET phase = 'merging', no_progress_streak = 3`,
    );
    await userSays({ world, id: 'outbox-user-1', text: 'Keep going' });
    const blocked = await treeOf(world);
    expect(blocked).toMatchObject({
      phase: 'blocked',
      blockedReason: AUTO_BLOCK_TEXT.limit_no_progress,
    });

    for (let index = 0; index < 20; index += 1) {
      await tick(world);
    }

    expect((await treeOf(world))?.phaseRev).toBe(blocked?.phaseRev);
    expect(world.state.ports.autoTurns).toHaveLength(0);
  });

  it('starts over from the no progress limit on Retry', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await world.state.world.db.execute(
      `UPDATE auto_trees SET phase = 'merging', no_progress_streak = 3`,
    );
    await userSays({ world, id: 'outbox-user-1', text: 'Keep going' });

    expect(await world.runtime.retry(world.treeId)).toEqual({ kind: 'retried', phase: 'merging' });
    await world.runtime.settled();

    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', noProgressStreak: 0 });
    expect(world.state.ports.autoTurns).toHaveLength(1);
  });

  it('grants a few more turns on Retry at the turn limit, until the grants run out', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await world.state.world.db.execute(`UPDATE auto_trees SET phase = 'merging', turns_used = 30`);
    await userSays({ world, id: 'outbox-user-1', text: 'Keep going' });
    expect((await treeOf(world))?.blockedReason).toBe(AUTO_BLOCK_TEXT.limit_turns);

    expect((await world.runtime.retry(world.treeId)).kind).toBe('retried');
    await world.runtime.settled();
    expect(await treeOf(world)).toMatchObject({ phase: 'deciding', grants: 1 });

    await world.state.world.db.execute(
      `UPDATE auto_trees SET phase = 'blocked', grants = ?, turns_used = ?`,
      [
        AUTO_MAX_GRANTS_PER_TREE,
        effectiveTreeLimits({ grants: AUTO_MAX_GRANTS_PER_TREE }).autoTurns,
      ],
    );
    const refused = await world.runtime.retry(world.treeId);
    expect(refused.kind).toBe('refused');
    expect((await treeOf(world))?.phase).toBe('blocked');
  });

  it('refuses Retry past the time limit and writes nothing', async () => {
    const world = await deciding();
    pastStale(world);
    await tick(world);
    await world.state.world.db.execute(`UPDATE auto_trees SET hard_deadline_at = 0`);
    const before = await treeOf(world);

    expect(await world.runtime.retry(world.treeId)).toEqual({
      kind: 'refused',
      message: AUTO_BLOCK_TEXT.limit_wall_clock,
    });
    expect((await treeOf(world))?.phaseRev).toBe(before?.phaseRev);
  });
});
