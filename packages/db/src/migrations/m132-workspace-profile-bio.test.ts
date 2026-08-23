import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-08-23T10:00:00.000Z');

type SeedProfileParams = {
  readonly db: Database;
  readonly workspaceId: string;
  readonly role: string | null;
  readonly discipline: string | null;
  readonly topics: string | null;
  readonly notes: string | null;
};

const seedThrough131 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 131),
  );
  return db;
};

const seedProfile = async ({
  db,
  workspaceId,
  role,
  discipline,
  topics,
  notes,
}: SeedProfileParams): Promise<void> => {
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [workspaceId, workspaceId, workspaceId, NOW, NOW],
  );
  await db.execute(
    `INSERT INTO workspace_profiles (workspace_id, role, discipline, topics, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [workspaceId, role, discipline, topics, notes, NOW],
  );
};

type ProfileRow = {
  readonly workspace_id: string;
  readonly bio: string | null;
  readonly updated_at: number | null;
};

const profiles = async (db: Database): Promise<ReadonlyArray<ProfileRow>> =>
  db.select<ProfileRow>(
    'SELECT workspace_id, bio, updated_at FROM workspace_profiles ORDER BY workspace_id ASC',
  );

describe('m132 workspace profile bio', () => {
  it('concatenates a full structured profile into one readable bio', async () => {
    const db = await seedThrough131();
    await seedProfile({
      db,
      workspaceId: 'ws-full',
      role: 'developer',
      discipline: 'frontend',
      topics: '["design systems","a11y"]',
      notes: 'prefers short answers',
    });

    await migrate(db, migrations);

    expect(await profiles(db)).toEqual([
      {
        workspace_id: 'ws-full',
        bio: 'I write code. My work is closest to frontend. I care about design systems, a11y. prefers short answers',
        updated_at: NOW,
      },
    ]);
  });

  it('backfills partial rows and leaves empty rows with a null bio', async () => {
    const db = await seedThrough131();
    await seedProfile({
      db,
      workspaceId: 'ws-empty',
      role: null,
      discipline: null,
      topics: '[]',
      notes: null,
    });
    await seedProfile({
      db,
      workspaceId: 'ws-role',
      role: 'non-developer',
      discipline: null,
      topics: null,
      notes: null,
    });

    await migrate(db, migrations);

    expect(await profiles(db)).toEqual([
      { workspace_id: 'ws-empty', bio: null, updated_at: NOW },
      { workspace_id: 'ws-role', bio: 'I do not write code.', updated_at: NOW },
    ]);
  });

  it('reshapes the table to workspace_id, bio, updated_at with the workspace cascade intact', async () => {
    const db = await seedThrough131();
    await seedProfile({
      db,
      workspaceId: 'ws-gone',
      role: 'developer',
      discipline: null,
      topics: null,
      notes: null,
    });

    await migrate(db, migrations);

    const columns = await db.select<{ name: string }>(
      "SELECT name FROM pragma_table_info('workspace_profiles') ORDER BY cid ASC",
    );
    expect(columns.map((column) => column.name)).toEqual(['workspace_id', 'bio', 'updated_at']);

    await db.execute("DELETE FROM workspaces WHERE id = 'ws-gone'");
    expect(await profiles(db)).toEqual([]);
  });
});
