import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';

describe('m237 turn file sets', () => {
  it('adds an empty table and leaves every turn recorded before it without a set', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 236 });

    const result = await migrateThrough({ db, version: 237 });

    expect(result.applied).toEqual([237]);
    expect(await db.select('SELECT run_id FROM turn_file_sets')).toEqual([]);
    const columns = await db.select<{ name: string }>('PRAGMA table_info(turn_file_sets)');
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'run_id',
      'mount_id',
      'session_id',
      'own_json',
      'from_base_json',
      'is_partial',
      'recorded_at',
      'created_at',
      'updated_at',
    ]);
  });
});
