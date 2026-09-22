import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 164);

describe('m164 cluster completion holds', () => {
  it('creates constrained durable hold storage', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await migrate(db, migrations);

    const rows = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cluster_completion_holds'",
    );
    expect(rows).toEqual([{ name: 'cluster_completion_holds' }]);
  });
});
