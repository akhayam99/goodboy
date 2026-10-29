import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTO_BLOCK_TEXT } from '@goodboy/core';
import { getAutoTree, listAutoDelegations, listAutoOutbox } from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { readAutoTreeViews } from '../../slices/auto-view/readAutoTreeViews';
import { deliverNext } from './deliver';
import { addUserRow } from './testing/deliveryWorld';
import { WORLD_TREE } from './testing/autoWorld';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const SCOUT = { role: 'scout', task: 'find the export callers', reason: 'read only search' };

const MESSAGE_ID = 'outbox-user-2';

const waitingWorld = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'look at the ledger export' });
  await autoDelegates({ world, spec: { children: [SCOUT] } });
  await autoTurnEnds({ world });
  await addUserRow({
    world: world.state.world,
    id: MESSAGE_ID,
    text: 'also check notify-relay',
    atMs: world.state.world.clock.now() + 5,
  });
  await world.runtime.drive(world.treeId);
  return world;
};

const pendingIds = async (world: RuntimeWorld) =>
  (await listAutoOutbox({ db: world.state.world.db, treeId: WORLD_TREE, states: ['pending'] })).map(
    (row) => String(row.id),
  );

const acceptedIds = async (world: RuntimeWorld) =>
  (
    await listAutoOutbox({ db: world.state.world.db, treeId: WORLD_TREE, states: ['accepted'] })
  ).map((row) => String(row.id));

const turnsMentioning = (world: RuntimeWorld, text: string) =>
  world.state.ports.autoTurns.filter((turn) => turn.text.includes(text));

const setPhase = ({ world, phase, reason }: PhaseParams) =>
  world.state.world.db.execute('UPDATE auto_trees SET phase = ?, blocked_reason = ? WHERE id = ?', [
    phase,
    reason ?? null,
    WORLD_TREE,
  ]);

type PhaseParams = {
  readonly world: RuntimeWorld;
  readonly phase: string;
  readonly reason?: string;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a message sent while the children run', () => {
  it('waits in the outbox and reaches the view as a pending message', async () => {
    const world = await waitingWorld();

    expect(await pendingIds(world)).toEqual([MESSAGE_ID]);
    expect(world.state.ports.autoTurns).toHaveLength(1);
    const views = await readAutoTreeViews({
      db: world.state.world.db,
      sessionId: brandId<SessionId>({ value: 'session-harborline' }),
    });
    expect(views[0]?.pendingMessages.map((message) => message.rowId)).toEqual([MESSAGE_ID]);
  });

  it('Send now delivers it as its own turn and leaves the children running', async () => {
    const world = await waitingWorld();

    const outcome = await world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID });
    await world.runtime.settled();

    expect(outcome).toMatchObject({ kind: 'delivered', deliveryId: MESSAGE_ID });
    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(world.state.ports.autoTurns[1]?.text).toContain('also check notify-relay');
    expect(await pendingIds(world)).toEqual([]);
    expect(await acceptedIds(world)).toContain(MESSAGE_ID);
    const [delegation] = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegation?.state).toBe('running');
    const views = await readAutoTreeViews({
      db: world.state.world.db,
      sessionId: brandId<SessionId>({ value: 'session-harborline' }),
    });
    expect(views[0]?.pendingMessages).toEqual([]);
    expect(world.errors).toEqual([]);
  });

  it('is delivered once when Send now is pressed twice at the same time', async () => {
    const world = await waitingWorld();

    await Promise.all([
      world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID }),
      world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID }),
    ]);
    await world.runtime.settled();

    expect(turnsMentioning(world, 'also check notify-relay')).toHaveLength(1);
    expect(await acceptedIds(world)).toContain(MESSAGE_ID);
  });

  it('is delivered once when Send now races with the child finishing', async () => {
    const world = await waitingWorld();
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }

    await Promise.all([
      world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID }),
      childTurnEnds({
        world,
        index: 0,
        text: `Found three callers.\n<<step-done id="${turn.childAgentId}">>`,
      }),
    ]);
    await world.runtime.settled();

    expect(turnsMentioning(world, 'also check notify-relay')).toHaveLength(1);
    expect(await pendingIds(world)).toEqual([]);
    expect(
      (await listAutoOutbox({ db: world.state.world.db, treeId: WORLD_TREE })).filter(
        (row) => row.id === MESSAGE_ID && row.state === 'accepted',
      ),
    ).toHaveLength(1);
    expect(world.errors).toEqual([]);
  });

  it('goes with the results, after them, when the child finishes first', async () => {
    const world = await waitingWorld();
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }

    await childTurnEnds({
      world,
      index: 0,
      text: `Found three callers.\n<<step-done id="${turn.childAgentId}">>`,
    });

    const text = world.state.ports.autoTurns[1]?.text ?? '';
    expect(text.indexOf('RESULTS FROM YOUR AGENTS')).toBeLessThan(
      text.indexOf('also check notify-relay'),
    );
    expect(turnsMentioning(world, 'also check notify-relay')).toHaveLength(1);
    expect(await pendingIds(world)).toEqual([]);
  });

  it('is not sent now once it was delivered', async () => {
    const world = await waitingWorld();
    await world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID });
    await world.runtime.settled();
    const turns = world.state.ports.autoTurns.length;

    const again = await world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID });

    expect(again).toMatchObject({ kind: 'idle' });
    expect(world.state.ports.autoTurns).toHaveLength(turns);
  });
});

describe('the watchdog of a waiting tree', () => {
  it('delivers a user message when no child runs and logs one line', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const world = await makeRuntimeWorld();
    await setPhase({ world, phase: 'waiting' });
    await addUserRow({ world: world.state.world, id: MESSAGE_ID, text: 'any news?' });

    const outcome = await deliverNext({
      ctx: world.state.ctx,
      treeId: world.treeId,
      onEnded: world.state.onEnded,
    });

    expect(outcome).toMatchObject({ kind: 'delivered', deliveryId: MESSAGE_ID });
    expect(world.state.ports.autoTurns[0]?.text).toContain('any news?');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^\[auto\]/);
  });

  it('keeps the message waiting while a child runs', async () => {
    const world = await waitingWorld();

    await world.runtime.drive(world.treeId);

    expect(await pendingIds(world)).toEqual([MESSAGE_ID]);
  });

  it('lets a tick deliver it once the running child is gone', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const world = await waitingWorld();
    await world.state.world.db.execute(
      `UPDATE auto_delegations SET state = 'settled', outcome = 'failed', settled_at = ?`,
      [world.state.world.clock.now()],
    );
    await world.state.world.db.execute(
      `UPDATE auto_outbox SET state = 'dropped', dropped_reason = 'test' WHERE kind = 'results'`,
    );

    const outcome = await deliverNext({
      ctx: world.state.ctx,
      treeId: world.treeId,
      onEnded: world.state.onEnded,
    });

    expect(outcome).toMatchObject({ kind: 'delivered', deliveryId: MESSAGE_ID });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('a message sent to a tree that cannot take it', () => {
  const drive = (world: RuntimeWorld) =>
    deliverNext({ ctx: world.state.ctx, treeId: world.treeId, onEnded: world.state.onEnded });

  it('stays pending, never sent, when the time limit blocked the tree', async () => {
    const world = await makeRuntimeWorld();
    await setPhase({ world, phase: 'blocked', reason: AUTO_BLOCK_TEXT.limit_wall_clock });
    await addUserRow({ world: world.state.world, id: MESSAGE_ID, text: 'one more thing' });

    expect(await drive(world)).toMatchObject({ kind: 'idle', reason: 'blocked' });
    expect(world.state.ports.autoTurns).toHaveLength(0);
    expect(await pendingIds(world)).toEqual([MESSAGE_ID]);
    const views = await readAutoTreeViews({
      db: world.state.world.db,
      sessionId: brandId<SessionId>({ value: 'session-harborline' }),
    });
    expect(views[0]?.pendingMessages).toHaveLength(1);
    expect(views[0]?.tree.phase).toBe('blocked');
  });

  it('is delivered after Retry when a provider problem blocked the tree', async () => {
    const world = await makeRuntimeWorld();
    await setPhase({ world, phase: 'blocked', reason: 'Claude is not signed in' });
    await addUserRow({ world: world.state.world, id: MESSAGE_ID, text: 'one more thing' });

    expect(await drive(world)).toMatchObject({ kind: 'idle', reason: 'blocked' });
    await world.runtime.retry(world.treeId);
    await world.runtime.settled();

    expect(world.state.ports.autoTurns[0]?.text).toContain('one more thing');
    expect(await pendingIds(world)).toEqual([]);
  });

  it('stays pending, never sent, when the tree was stopped', async () => {
    const world = await makeRuntimeWorld();
    await setPhase({ world, phase: 'stopped' });
    await world.state.world.db.execute(`UPDATE auto_trees SET stop_state = 'confirmed'`);
    await addUserRow({ world: world.state.world, id: MESSAGE_ID, text: 'one more thing' });

    expect(await drive(world)).toMatchObject({ kind: 'idle', reason: 'stopped' });
    expect(world.state.ports.autoTurns).toHaveLength(0);
    expect(await pendingIds(world)).toEqual([MESSAGE_ID]);
    expect((await getAutoTree({ db: world.state.world.db, treeId: WORLD_TREE }))?.phase).toBe(
      'stopped',
    );
  });

  it('starts a new turn when the tree finished', async () => {
    const world = await makeRuntimeWorld();
    await setPhase({ world, phase: 'finished' });
    await addUserRow({ world: world.state.world, id: MESSAGE_ID, text: 'one more thing' });

    expect(await drive(world)).toMatchObject({ kind: 'delivered', deliveryId: MESSAGE_ID });
    expect(world.state.ports.autoTurns[0]?.text).toContain('one more thing');
  });

  it('starts a new turn when the tree is done', async () => {
    const world = await makeRuntimeWorld();
    await setPhase({ world, phase: 'done' });
    await addUserRow({ world: world.state.world, id: MESSAGE_ID, text: 'one more thing' });

    expect(await drive(world)).toMatchObject({ kind: 'delivered', deliveryId: MESSAGE_ID });
  });
});

describe('Send now outside a waiting tree', () => {
  it('delivers a message of a tree that is not waiting the usual way', async () => {
    const world = await makeRuntimeWorld();
    await setPhase({ world, phase: 'answering' });
    await addUserRow({ world: world.state.world, id: MESSAGE_ID, text: 'one more thing' });

    const outcome = await world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID });

    expect(outcome).toMatchObject({ kind: 'delivered' });
    expect(world.state.ports.autoTurns).toHaveLength(1);
  });
});
