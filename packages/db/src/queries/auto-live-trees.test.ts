import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { seedAutoSession, seedAutoTree } from '../test-helpers/auto-seeds';
import { countLiveAutoTrees } from './auto-live-trees';

describe('countLiveAutoTrees', () => {
  it('counts the trees that are working, not the ones that answer, finished or stopped', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db });
    await seedAutoTree({ db });
    expect(await countLiveAutoTrees({ db })).toBe(0);

    await db.execute("UPDATE auto_trees SET phase = 'waiting'");
    expect(await countLiveAutoTrees({ db })).toBe(1);

    await db.execute("UPDATE auto_trees SET phase = 'merging'");
    expect(await countLiveAutoTrees({ db })).toBe(1);

    for (const phase of ['answering', 'done', 'stopped', 'blocked']) {
      await db.execute('UPDATE auto_trees SET phase = ?', [phase]);
      expect(await countLiveAutoTrees({ db })).toBe(0);
    }
  });
});
