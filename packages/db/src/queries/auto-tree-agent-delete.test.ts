import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_ROOT, seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import { purgeAgentForDelete } from './agent';
import { getAutoTree, listAutoTreesToRecover } from './auto-trees';

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  const tree = await seedAutoTree({ db });
  return { db, tree };
};

describe('deleting the root agent of an Auto tree', () => {
  it('settles the tree as stopped, so no card can wait on an agent that is gone', async () => {
    const { db, tree } = await world();
    await db.execute("UPDATE auto_trees SET phase = 'waiting' WHERE id = ?", [tree.id]);

    await purgeAgentForDelete({ db, id: AUTO_SEED_ROOT });

    const settled = await getAutoTree({ db, treeId: tree.id });
    expect(settled).toMatchObject({
      phase: 'stopped',
      stopState: 'confirmed',
      blockedReason: 'agent_deleted',
    });
    expect(settled?.phaseRev).toBe(tree.phaseRev + 1);
  });

  it('settles a tree that was blocked or still stopping, and leaves it out of recovery', async () => {
    const { db, tree } = await world();
    await db.execute(
      "UPDATE auto_trees SET phase = 'stopping', stop_state = 'confirming' WHERE id = ?",
      [tree.id],
    );

    await purgeAgentForDelete({ db, id: AUTO_SEED_ROOT });

    expect((await getAutoTree({ db, treeId: tree.id }))?.phase).toBe('stopped');
    expect((await listAutoTreesToRecover({ db })).map((one) => one.id)).not.toContain(tree.id);
  });

  it('leaves a finished tree as it was', async () => {
    const { db, tree } = await world();
    await db.execute("UPDATE auto_trees SET phase = 'finished' WHERE id = ?", [tree.id]);

    await purgeAgentForDelete({ db, id: AUTO_SEED_ROOT });

    expect(await getAutoTree({ db, treeId: tree.id })).toMatchObject({
      phase: 'finished',
      blockedReason: null,
    });
  });
});
