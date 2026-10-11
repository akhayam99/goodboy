import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const CREATED = Date.parse('2026-09-20T09:00:00Z');
const STARRED = Date.parse('2026-10-02T09:00:00Z');
const REFRESHED = Date.parse('2026-10-03T09:00:00Z');

type StarRow = {
  readonly external_id: string;
  readonly title: string;
  readonly state: string;
  readonly state_label: string | null;
  readonly starred_at: number;
  readonly refreshed_at: number | null;
};

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 228 });
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at, default_branch_prefix) VALUES (?, ?, ?, ?, ?, ?)',
    ['harborline', 'Harborline', 'harborline', CREATED, CREATED, 'hl'],
  );
  for (const id of ['hl-1', 'hl-2', 'hl-3']) {
    await db.execute(
      `INSERT INTO workspace_external_tasks (workspace_id, provider, external_id, identifier, url, title, created_at)
       VALUES ('harborline', 'linear', ?, ?, ?, ?, ?)`,
      [id, id.toUpperCase(), `https://linear.app/harborline/issue/${id}`, `Task ${id}`, CREATED],
    );
  }
  await db.execute(
    `INSERT INTO workspace_starred_issues
       (workspace_id, provider, external_id, identifier, container, title, url, state, state_label, starred_at, refreshed_at)
     VALUES ('harborline', 'linear', 'hl-2', 'HL-2', NULL, 'Starred copy', 'https://linear.app/x', 'active', 'In progress', ?, ?)`,
    [STARRED, REFRESHED],
  );
  return db;
};

const starsOf = (db: Database) =>
  db.select<StarRow>(
    'SELECT external_id, title, state, state_label, starred_at, refreshed_at FROM workspace_starred_issues ORDER BY external_id',
  );

describe('m229 ongoing to stars', () => {
  it('turns every ongoing task into an open star dated by its link', async () => {
    const db = await seed();
    const result = await migrate(db, migrations);

    expect(result.applied).toContain(229);
    const stars = await starsOf(db);
    expect(stars.map((star) => star.external_id)).toEqual(['hl-1', 'hl-2', 'hl-3']);
    expect(stars.filter((star) => star.external_id !== 'hl-2')).toEqual([
      {
        external_id: 'hl-1',
        title: 'Task hl-1',
        state: 'open',
        state_label: null,
        starred_at: CREATED,
        refreshed_at: null,
      },
      {
        external_id: 'hl-3',
        title: 'Task hl-3',
        state: 'open',
        state_label: null,
        starred_at: CREATED,
        refreshed_at: null,
      },
    ]);
  });

  it('keeps an existing star as it was', async () => {
    const db = await seed();
    await migrate(db, migrations);

    expect((await starsOf(db)).find((star) => star.external_id === 'hl-2')).toEqual({
      external_id: 'hl-2',
      title: 'Starred copy',
      state: 'active',
      state_label: 'In progress',
      starred_at: STARRED,
      refreshed_at: REFRESHED,
    });
  });

  it('drops the ongoing table', async () => {
    const db = await seed();
    await migrate(db, migrations);

    const tables = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspace_external_tasks'",
    );
    expect(tables).toEqual([]);
  });

  it('migrates a database with no ongoing task', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 228 });
    await migrate(db, migrations);

    expect(await starsOf(db)).toEqual([]);
  });
});
