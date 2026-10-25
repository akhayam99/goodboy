// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDemoSettingsTable } from './demoSettingsTable';

const SELECT = 'SELECT value FROM workspace_values WHERE workspace_id = ? AND key = ?';
const INSERT_IF_ABSENT = `INSERT INTO workspace_values (workspace_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(workspace_id, key) DO NOTHING`;
const REPLACE_IF_UNCHANGED =
  'UPDATE workspace_values SET value = ?, updated_at = ? WHERE workspace_id = ? AND key = ? AND value = ?';

describe('the demo workspace values', () => {
  it('reads nothing before a value is written', () => {
    const table = createDemoSettingsTable();

    expect(table.select({ sql: SELECT, params: ['workspace-1', 'auto.treeLimitUsd'] })).toEqual([]);
  });

  it('writes a value once and reads it back for the same workspace only', () => {
    const table = createDemoSettingsTable();
    const first = table.execute({
      sql: INSERT_IF_ABSENT,
      params: ['workspace-1', 'auto.treeLimitUsd', '5', 1],
    });
    const second = table.execute({
      sql: INSERT_IF_ABSENT,
      params: ['workspace-1', 'auto.treeLimitUsd', '9', 2],
    });

    expect(first?.rowsAffected).toBe(1);
    expect(second?.rowsAffected).toBe(0);
    expect(table.select({ sql: SELECT, params: ['workspace-1', 'auto.treeLimitUsd'] })).toEqual([
      { value: '5' },
    ]);
    expect(table.select({ sql: SELECT, params: ['workspace-2', 'auto.treeLimitUsd'] })).toEqual([]);
  });

  it('replaces a value only while it is the one the caller read', () => {
    const table = createDemoSettingsTable();
    table.execute({
      sql: INSERT_IF_ABSENT,
      params: ['workspace-1', 'auto.treeLimitUsd', '5', 1],
    });

    const stale = table.execute({
      sql: REPLACE_IF_UNCHANGED,
      params: ['8', 2, 'workspace-1', 'auto.treeLimitUsd', '4'],
    });
    const fresh = table.execute({
      sql: REPLACE_IF_UNCHANGED,
      params: ['8', 3, 'workspace-1', 'auto.treeLimitUsd', '5'],
    });

    expect(stale?.rowsAffected).toBe(0);
    expect(fresh?.rowsAffected).toBe(1);
    expect(table.select({ sql: SELECT, params: ['workspace-1', 'auto.treeLimitUsd'] })).toEqual([
      { value: '8' },
    ]);
  });
});
