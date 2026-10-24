import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_ROOT, seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import { purgeAgentForDelete } from './agent';
import { getAutoTree } from './auto-trees';

const world = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  const tree = await seedAutoTree({ db });
  return { db, tree };
};

describe('purging the root agent of an Auto tree', () => {
  it('never confirms a stop by itself, the stop protocol owns that', async () => {
    const { db, tree } = await world();
    await db.execute("UPDATE auto_trees SET phase = 'waiting' WHERE id = ?", [tree.id]);

    await purgeAgentForDelete({ db, id: AUTO_SEED_ROOT });

    expect(await getAutoTree({ db, treeId: tree.id })).toMatchObject({
      phase: 'waiting',
      stopState: 'none',
      blockedReason: null,
      phaseRev: tree.phaseRev,
      generation: tree.generation,
    });
  });

  it('leaves a tree that is still confirming its stop as it was', async () => {
    const { db, tree } = await world();
    await db.execute(
      "UPDATE auto_trees SET phase = 'stopping', stop_state = 'confirming' WHERE id = ?",
      [tree.id],
    );

    await purgeAgentForDelete({ db, id: AUTO_SEED_ROOT });

    expect(await getAutoTree({ db, treeId: tree.id })).toMatchObject({
      phase: 'stopping',
      stopState: 'confirming',
    });
  });
});
