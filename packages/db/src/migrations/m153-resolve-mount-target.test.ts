import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 153);
const through = migrations.filter((migration) => migration.version <= 153);

type MountCount = { readonly mounts: number };

const seed = async ({ mountCount }: { readonly mountCount: number }): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db, before);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('project', 'workspace', 'Api', '/repo/api', 'repo', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  for (let index = 0; index < mountCount; index += 1) {
    await db.execute(
      `INSERT INTO session_worktrees (id, session_id, project_id, worktree_path, last_worktree_path, branch, parallel_index, mount_name, is_attached, disk_state, revision, created_at, updated_at)
       VALUES (?, 'session', 'project', ?, ?, ?, ?, 'api', 1, 'present', ?, 1, 1)`,
      [
        `mount-${index}`,
        `/repo/api/.goodboy/worktrees/m${index}`,
        `/repo/api/.goodboy/worktrees/m${index}`,
        `ak/feat-${index}`,
        index,
        index,
      ],
    );
  }
  await db.execute(
    `INSERT INTO resolve_attempts (id, session_id, agent_id, pr_number, thread_ids_json, provider, model, phase, created_at)
     VALUES ('attempt-a', 'session', 'agent-a', 12, '["PRRT_1"]', 'anthropic', 'recorded-model', 'queued', 1),
            ('attempt-b', 'session', 'agent-b', 12, '["PRRT_2"]', 'anthropic', 'recorded-model', 'finished', 2)`,
  );
  await db.execute(
    `INSERT INTO resolve_candidates (id, session_id, revision, base_sha, candidate_sha, worktree_path, state, created_at, updated_at)
     VALUES ('candidate-a', 'session', 1, 'base', 'cand', '/repo/api/.goodboy/worktrees/m0', 'ready', 1, 1)`,
  );
  await db.execute(
    `INSERT INTO resolve_publications (id, session_id, repo, pr_number, branch, target_ref, local_head, commit_shas_json, candidate_ids_json, approved_item_ids_json, requires_push, phase, created_at)
     VALUES ('publication-a', 'session', 'acme/api', 12, 'ak/feat-0', 'refs/heads/ak/feat-0', 'aaaa111', '["aaaa111"]', '["candidate-a"]', '["item-a"]', 1, 'previewed', 1)`,
  );
  return db;
};

const columnsOf = async ({
  db,
  table,
}: {
  readonly db: Database;
  readonly table: string;
}): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ readonly name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((row) => row.name);
};

const MOUNT_COUNTS: ReadonlyArray<number> = [0, 1, 3];

describe('m153 resolve mount target', () => {
  it('rejects the target columns before the migration', async () => {
    const db = await seed({ mountCount: 1 });
    await expect(
      db.execute("UPDATE resolve_attempts SET mount_id = 'mount-0' WHERE id = 'attempt-a'"),
    ).rejects.toThrow(/no such column/);
  });

  for (const mountCount of MOUNT_COUNTS) {
    it(`adds the target columns and keeps every row with ${mountCount} mounts`, async () => {
      const db = await seed({ mountCount });
      await migrate(db, through);

      expect(await columnsOf({ db, table: 'resolve_attempts' })).toEqual(
        expect.arrayContaining(['mount_id', 'mount_revision', 'worktree_path']),
      );
      expect(await columnsOf({ db, table: 'resolve_candidates' })).toEqual(
        expect.arrayContaining(['mount_id', 'mount_revision']),
      );
      expect(await columnsOf({ db, table: 'resolve_publications' })).toEqual(
        expect.arrayContaining(['mount_id', 'mount_revision', 'worktree_path']),
      );

      expect(
        await db.select<MountCount>(
          "SELECT COUNT(*) AS mounts FROM session_worktrees WHERE session_id = 'session'",
        ),
      ).toEqual([{ mounts: mountCount }]);
      expect(
        await db.select<{ readonly id: string }>('SELECT id FROM resolve_attempts ORDER BY id'),
      ).toEqual([{ id: 'attempt-a' }, { id: 'attempt-b' }]);
      expect(
        await db.select<{ readonly id: string }>('SELECT id FROM resolve_candidates ORDER BY id'),
      ).toEqual([{ id: 'candidate-a' }]);
      expect(
        await db.select<{ readonly id: string }>('SELECT id FROM resolve_publications ORDER BY id'),
      ).toEqual([{ id: 'publication-a' }]);
    });
  }

  it('leaves every migrated row without a target instead of guessing one', async () => {
    const db = await seed({ mountCount: 3 });
    await migrate(db, through);
    expect(
      await db.select<{ readonly mount_id: string | null; readonly mount_revision: number | null }>(
        'SELECT mount_id, mount_revision FROM resolve_attempts ORDER BY id',
      ),
    ).toEqual([
      { mount_id: null, mount_revision: null },
      { mount_id: null, mount_revision: null },
    ]);
    expect(
      await db.select<{ readonly mount_id: string | null }>(
        'SELECT mount_id FROM resolve_candidates',
      ),
    ).toEqual([{ mount_id: null }]);
    expect(
      await db.select<{ readonly mount_id: string | null }>(
        'SELECT mount_id FROM resolve_publications',
      ),
    ).toEqual([{ mount_id: null }]);
  });

  it('indexes the target on every resolve table', async () => {
    const db = await seed({ mountCount: 1 });
    await migrate(db, through);
    expect(
      await db.select<{ readonly name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_resolve_%_mount' ORDER BY name`,
      ),
    ).toEqual([
      { name: 'idx_resolve_attempts_mount' },
      { name: 'idx_resolve_candidates_mount' },
      { name: 'idx_resolve_publications_mount' },
    ]);
  });

  it('keeps the target and the history when the mount it points at is removed', async () => {
    const db = await seed({ mountCount: 2 });
    await migrate(db, through);
    await db.execute(
      "UPDATE resolve_attempts SET mount_id = 'mount-1', mount_revision = 1, worktree_path = '/repo/api/.goodboy/worktrees/m1' WHERE id = 'attempt-b'",
    );
    await db.execute("DELETE FROM session_worktrees WHERE id = 'mount-1'");
    expect(
      await db.select<{ readonly mount_id: string | null; readonly worktree_path: string | null }>(
        "SELECT mount_id, worktree_path FROM resolve_attempts WHERE id = 'attempt-b'",
      ),
    ).toEqual([{ mount_id: 'mount-1', worktree_path: '/repo/api/.goodboy/worktrees/m1' }]);
  });

  it('applies in a single transactional segment', async () => {
    const db = await seed({ mountCount: 1 });
    await migrate(db, through);
    expect(
      await db.select<{ readonly segments: number }>(
        'SELECT COUNT(*) AS segments FROM schema_migration_segment WHERE version = 153',
      ),
    ).toEqual([{ segments: 0 }]);
    expect(
      await db.select<{ readonly version: number }>(
        'SELECT version FROM schema_version WHERE version = 153',
      ),
    ).toEqual([{ version: 153 }]);
  });
});
