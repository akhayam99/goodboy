import { describe, expect, expectTypeOf, it } from 'vitest';
import { OVERRIDE_COLUMN_OF_KEY, OVERRIDE_COLUMNS } from '@goodboy/types';
import type { ConfigBundleWorkspaceOverrides, OverrideSettings } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';

const WORKSPACE_COLUMNS_THAT_ARE_NOT_OVERRIDES: ReadonlyArray<string> = [
  'id',
  'name',
  'slug',
  'created_at',
  'updated_at',
  'deleted_at',
  'disconnected_at',
  'last_accessed_at',
  'default_permission_mode',
];

type TableColumn = {
  readonly name: string;
};

const workspaceColumns = async (): Promise<ReadonlyArray<string>> => {
  const db = await makeMigratedTestDatabase();
  const rows = await db.select<TableColumn>('PRAGMA table_info(workspaces)');
  return rows.map((row) => row.name);
};

describe('the workspace override column list', () => {
  it('names every override column of the migrated workspaces table and no other', async () => {
    const columns = await workspaceColumns();

    const declared = [...OVERRIDE_COLUMNS, ...WORKSPACE_COLUMNS_THAT_ARE_NOT_OVERRIDES].sort();

    expect(declared).toEqual([...columns].sort());
  });

  it('has no column twice', () => {
    expect(new Set(OVERRIDE_COLUMNS).size).toBe(OVERRIDE_COLUMNS.length);
  });

  it('maps every override key to one column and every column to one key', () => {
    const mapped = Object.values(OVERRIDE_COLUMN_OF_KEY).sort();

    expect(mapped).toEqual([...OVERRIDE_COLUMNS].sort());
  });

  it('keeps the backup bundle override keys identical to the override keys', () => {
    expectTypeOf<keyof ConfigBundleWorkspaceOverrides>().toEqualTypeOf<keyof OverrideSettings>();
  });
});
