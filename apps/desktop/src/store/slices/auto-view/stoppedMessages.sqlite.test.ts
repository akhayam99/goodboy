import { describe, expect, it } from 'vitest';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { addUserRow } from '../../runtime/auto/testing/deliveryWorld';
import { makeRuntimeWorld, type RuntimeWorld } from '../../runtime/auto/testing/runtimeWorld';
import { readAutoTreeViews } from './readAutoTreeViews';

const viewOf = async (world: RuntimeWorld) => {
  const views = await readAutoTreeViews({ db: world.state.world.db, sessionId: AUTO_SEED_SESSION });
  const [view] = views;
  if (view === undefined) {
    throw new Error('a tree was expected');
  }
  return view;
};

describe('a message the user wrote before stopping Auto', () => {
  it('stays in the view as not delivered once Auto is stopped', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await addUserRow({ world: world.state.world, id: 'outbox-user-1', text: 'split the export' });
    expect((await viewOf(world)).pendingMessages.map((message) => message.rowId)).toEqual([
      'outbox-user-1',
    ]);

    await world.runtime.stop(world.treeId);

    const stopped = await viewOf(world);
    expect(stopped.tree.phase).toBe('stopped');
    expect(stopped.pendingMessages.map((message) => message.rowId)).toEqual(['outbox-user-1']);
  });

  it('is not shown for a message dropped for another reason', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await addUserRow({ world: world.state.world, id: 'outbox-user-1', text: 'split the export' });
    await world.state.world.db.execute(
      "UPDATE auto_outbox SET state = 'dropped', dropped_reason = 'superseded'",
      [],
    );

    expect((await viewOf(world)).pendingMessages).toEqual([]);
  });
});
