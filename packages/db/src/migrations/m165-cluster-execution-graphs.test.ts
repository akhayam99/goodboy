import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 165);

describe('m165 cluster execution graphs', () => {
  it('creates the consumed graph snapshot and node execution tables', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await migrate(db, migrations);

    const rows = await db.select<{ readonly name: string }>(
      `SELECT name FROM sqlite_master
        WHERE type = 'table' AND name IN ('cluster_execution_graphs', 'cluster_execution_nodes')
        ORDER BY name`,
    );
    expect(rows).toEqual([
      { name: 'cluster_execution_graphs' },
      { name: 'cluster_execution_nodes' },
    ]);
  });
});
