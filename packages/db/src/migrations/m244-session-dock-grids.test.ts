import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { foreignKeyViolations, migrateThrough } from '../test-helpers/migration-rows';
import { AUTO_SEED_NOW, AUTO_SEED_SESSION, seedAutoSession } from '../test-helpers/auto-seeds';

const GRID = '{"version":1,"columns":[],"used":[],"focus":{"at":"page"},"widths":{}}';

describe('m244 session dock grids', () => {
  it('adds an empty table on a database the previous build left at m243', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 243 });
    await seedAutoSession({ db });

    const result = await migrateThrough({ db, version: 244 });

    expect(result.applied).toEqual([244]);
    expect(await db.select('SELECT session_id FROM session_dock_grids')).toEqual([]);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('keeps one grid per session, refuses a grid that is not JSON and drops it with its session', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAutoSession({ db });
    const insert = (id: string, grid: string) =>
      db.execute(
        'INSERT INTO session_dock_grids (id, session_id, grid, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, AUTO_SEED_SESSION, grid, AUTO_SEED_NOW, AUTO_SEED_NOW],
      );

    await insert('grid-1', GRID);
    await expect(insert('grid-2', GRID)).rejects.toThrow();
    await expect(
      db.execute("UPDATE session_dock_grids SET grid = 'terminal' WHERE id = 'grid-1'"),
    ).rejects.toThrow();

    await db.execute('DELETE FROM sessions WHERE id = ?', [AUTO_SEED_SESSION]);
    expect(await db.select('SELECT id FROM session_dock_grids')).toEqual([]);
  });
});
