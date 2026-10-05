import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';

describe('m224 artifact comments', () => {
  it('creates the table with its indexes on an existing database', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 223 });
    const result = await migrateThrough({ db, version: 224 });
    expect(result.applied).toEqual([224]);
    const columns = await db.select<{ name: string }>('PRAGMA table_info(artifact_comments)');
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'session_id',
      'artifact_id',
      'revision',
      'anchor_json',
      'body',
      'status',
      'sent_turn_id',
      'created_at',
      'updated_at',
    ]);
    const indexes = await db.select<{ name: string }>('PRAGMA index_list(artifact_comments)');
    expect(indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining(['idx_artifact_comments_artifact', 'idx_artifact_comments_session']),
    );
  });
});
