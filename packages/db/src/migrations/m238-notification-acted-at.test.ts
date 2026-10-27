import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertRow, migrateThrough } from '../test-helpers/migration-rows';

describe('m238 notification acted at', () => {
  it('adds an empty acted_at column and leaves every older notification not acted on', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 237 });
    await insertRow({
      db,
      table: 'notifications',
      row: {
        id: 'older',
        ts: 1,
        kind: 'error',
        title: 'Handoff degraded',
        severity: 'error',
        read: 0,
      },
    });

    const result = await migrateThrough({ db, version: 238 });

    expect(result.applied).toEqual([238]);
    const rows = await db.select<{ id: string; acted_at: number | null }>(
      'SELECT id, acted_at FROM notifications',
    );
    expect(rows).toEqual([{ id: 'older', acted_at: null }]);
  });
});
