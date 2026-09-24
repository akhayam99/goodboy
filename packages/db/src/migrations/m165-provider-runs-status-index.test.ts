import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

type PlanRow = {
  readonly detail: string;
};

describe('m165 provider runs status index', () => {
  it('adds no index before the migration', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 164 });
    const rows = await db.select(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_provider_runs_status_created'",
    );
    expect(rows).toEqual([]);
  });

  it('serves the stale in-flight scan from the new index', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 164 });
    await migrate(db, migrations);
    const plan = await db.select<PlanRow>(
      `EXPLAIN QUERY PLAN SELECT id FROM provider_runs
       WHERE status_kind IN ('pending', 'streaming') AND created_at < ?`,
      [1],
    );
    expect(plan.map((row) => row.detail).join(' ')).toContain('idx_provider_runs_status_created');
  });
});
