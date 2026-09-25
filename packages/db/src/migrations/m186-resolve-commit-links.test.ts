import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 179 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(`INSERT INTO resolve_threads
    (id, session_id, pr_number, thread_id, origin_kind, state, commit_shas_json, created_at, updated_at)
    VALUES ('row', 'session', 1, 'thread', 'review_comment', 'fixed', '["4f21c8b"]', 1, 1)`);
  return db;
};

const links = async (db: Awaited<ReturnType<typeof seed>>) =>
  db.select<{ readonly fixup_of_sha: string | null; readonly replaces_sha: string | null }>(
    'SELECT fixup_of_sha, replaces_sha FROM resolve_threads',
  );

describe('m186 resolve commit links', () => {
  it('leaves threads recorded before it without a fixup target or a replaced commit', async () => {
    const db = await seed();

    await migrate(db, migrations);

    expect(await links(db)).toEqual([{ fixup_of_sha: null, replaces_sha: null }]);
  });

  it('keeps the links a thread gained when a crash makes it run a second time', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await db.execute(
      "UPDATE resolve_threads SET fixup_of_sha = '3a1f9c2', replaces_sha = '7c1e0aa'",
    );
    await db.execute('DELETE FROM schema_version WHERE version = 186');

    await migrate(db, migrations);

    expect(await links(db)).toEqual([{ fixup_of_sha: '3a1f9c2', replaces_sha: '7c1e0aa' }]);
  });
});
