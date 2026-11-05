import { describe, expect, it } from 'vitest';
import { listAutoOutbox } from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { readAutoTreeViews } from '../../../slices/auto-view/readAutoTreeViews';
import { addUserRow } from '../testing/deliveryWorld';
import { WORLD_TREE } from '../testing/autoWorld';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const SCOUT = { role: 'scout', task: 'find the export callers', reason: 'read only search' };

const MESSAGE_ID = 'outbox-user-2';

const MESSAGE = 'also check notify-relay';

const waitingWorld = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'look at the ledger export' });
  await autoDelegates({ world, spec: { children: [SCOUT] } });
  await autoTurnEnds({ world });
  await addUserRow({
    world: world.state.world,
    id: MESSAGE_ID,
    text: MESSAGE,
    atMs: world.state.world.clock.now() + 5,
  });
  await world.runtime.drive(world.treeId);
  return world;
};

const rowOf = async (world: RuntimeWorld) =>
  (await listAutoOutbox({ db: world.state.world.db, treeId: WORLD_TREE })).find(
    (row) => String(row.id) === MESSAGE_ID,
  );

const viewOf = async (world: RuntimeWorld) => {
  const [view] = await readAutoTreeViews({
    db: world.state.world.db,
    sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  });
  return view;
};

const turnsMentioning = (world: RuntimeWorld) =>
  world.state.ports.autoTurns.filter((turn) => turn.text.includes(MESSAGE));

describe('withdrawing a message that waits', () => {
  it('drops the row with its own reason and takes it out of the view', async () => {
    const world = await waitingWorld();

    const outcome = await world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID });

    expect(outcome).toEqual({ kind: 'withdrawn' });
    const row = await rowOf(world);
    expect(row?.state).toBe('dropped');
    expect(row?.droppedReason).toBe('withdrawn');
    expect((await viewOf(world))?.pendingMessages).toEqual([]);
  });

  it('is never delivered when the child ends afterwards', async () => {
    const world = await waitingWorld();
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    await world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID });

    await childTurnEnds({
      world,
      index: 0,
      text: `Found three callers.\n<<step-done id="${turn.childAgentId}">>`,
    });
    await world.runtime.settled();

    expect(turnsMentioning(world)).toHaveLength(0);
    expect((await rowOf(world))?.droppedReason).toBe('withdrawn');
  });

  it('stays withdrawn after a restart over the same database', async () => {
    const world = await waitingWorld();
    await world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID });

    await world.runtime.recoverAll();
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    expect(turnsMentioning(world)).toHaveLength(0);
    expect((await viewOf(world))?.pendingMessages).toEqual([]);
  });

  it('answers withdrawn again when the same row is withdrawn twice', async () => {
    const world = await waitingWorld();

    await world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID });
    const again = await world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID });

    expect(again).toEqual({ kind: 'withdrawn' });
  });

  it('keeps a stopped message withdrawable, so Remove and Edit work on Not delivered', async () => {
    const world = await waitingWorld();
    await world.state.world.db.execute(
      `UPDATE auto_trees SET phase = 'stopped', stop_state = 'confirmed'`,
    );
    await world.state.world.db.execute(
      `UPDATE auto_outbox SET state = 'dropped', dropped_reason = 'stopped' WHERE id = ?`,
      [MESSAGE_ID],
    );
    expect((await viewOf(world))?.pendingMessages).toHaveLength(1);

    const outcome = await world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID });

    expect(outcome).toEqual({ kind: 'withdrawn' });
    expect((await viewOf(world))?.pendingMessages).toEqual([]);
  });
});

describe('withdrawing a message Auto already took', () => {
  it('changes nothing once Send now claimed it, and says it was delivered', async () => {
    const world = await waitingWorld();
    await world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID });
    await world.runtime.settled();

    const outcome = await world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID });

    expect(outcome).toEqual({ kind: 'delivered' });
    expect((await rowOf(world))?.state).toBe('accepted');
    expect(turnsMentioning(world)).toHaveLength(1);
  });

  it('delivers once or withdraws once when Send now and the withdraw race', async () => {
    const world = await waitingWorld();

    const [sent, withdrawn] = await Promise.all([
      world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID }),
      world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID }),
    ]);
    await world.runtime.settled();

    const row = await rowOf(world);
    if (withdrawn.kind === 'withdrawn') {
      expect(row?.droppedReason).toBe('withdrawn');
      expect(turnsMentioning(world)).toHaveLength(0);
      expect(sent).toMatchObject({ kind: 'idle' });
      return;
    }
    expect(withdrawn).toEqual({ kind: 'delivered' });
    expect(row?.state).toBe('accepted');
    expect(turnsMentioning(world)).toHaveLength(1);
  });

  it('says delivered when the child finishing claimed the row first', async () => {
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
    await world.runtime.settled();

    const outcome = await world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID });

    expect(outcome).toEqual({ kind: 'delivered' });
    expect(turnsMentioning(world)).toHaveLength(1);
  });

  it('says delivered for a row of another tree or a row that is gone', async () => {
    const world = await waitingWorld();

    const outcome = await world.runtime.withdraw({ treeId: world.treeId, rowId: 'outbox-nobody' });

    expect(outcome).toEqual({ kind: 'delivered' });
  });
});

describe('Send now after a withdraw', () => {
  it('finds no row and delivers nothing', async () => {
    const world = await waitingWorld();
    await world.runtime.withdraw({ treeId: world.treeId, rowId: MESSAGE_ID });
    const turns = world.state.ports.autoTurns.length;

    const outcome = await world.runtime.sendNow({ treeId: world.treeId, rowId: MESSAGE_ID });

    expect(outcome).toMatchObject({ kind: 'idle', reason: 'no_rows' });
    expect(world.state.ports.autoTurns).toHaveLength(turns);
  });
});
