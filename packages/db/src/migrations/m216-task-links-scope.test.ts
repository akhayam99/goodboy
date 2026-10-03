import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const NOW = Date.parse('2026-10-01T09:00:00Z');
const SESSION_COUNT = 12;
const LINKS_PER_SESSION = 4;

type DbParams = {
  readonly db: Database;
};

const seedPre016 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 215 });
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at, default_branch_prefix) VALUES (?, ?, ?, ?, ?, ?)',
    ['harborline', 'Harborline', 'harborline', NOW, NOW, 'hl'],
  );
  for (const project of ['payments-api', 'ledger-core']) {
    await db.execute(
      `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
       VALUES (?, 'harborline', ?, ?, 'repo', ?, ?)`,
      [project, project, `/work/${project}`, NOW, NOW],
    );
  }
  for (let index = 0; index < SESSION_COUNT; index += 1) {
    const sessionId = `s-${index}`;
    await db.execute(
      `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
       VALUES (?, 'harborline', ?, 'idle', ?, ?)`,
      [sessionId, `Goal ${index}`, NOW, NOW],
    );
    await db.execute(
      `INSERT INTO session_worktrees (id, session_id, worktree_path, branch, parallel_index, created_at, project_id)
       VALUES (?, ?, ?, ?, 0, ?, 'payments-api')`,
      [`w-${index}-a`, sessionId, `/wt/${index}/a`, `hl/payments-${index}`, NOW],
    );
    await db.execute(
      `INSERT INTO session_worktrees (id, session_id, worktree_path, branch, parallel_index, created_at, project_id)
       VALUES (?, ?, ?, ?, 1, ?, 'ledger-core')`,
      [`w-${index}-b`, sessionId, `/wt/${index}/b`, `hl/ledger-${index}`, NOW],
    );
    for (let link = 0; link < LINKS_PER_SESSION; link += 1) {
      const isManual = link % 2 === 0;
      const projectId = link === 3 ? 'ledger-core' : null;
      await db.execute(
        `INSERT INTO session_external_tasks
           (session_id, project_id, branch, provider, external_id, identifier, url, title, created_at)
         VALUES (?, ?, ?, 'linear', ?, ?, ?, 'Retry failed payments', ?)`,
        [
          sessionId,
          projectId,
          isManual ? `hl/linked-${index}` : null,
          `lin-${index}-${link}`,
          `HAR-${index}${link}`,
          `https://linear.app/harborline/issue/HAR-${index}${link}`,
          NOW + link,
        ],
      );
    }
  }
  return db;
};

type LinkRow = {
  readonly session_id: string;
  readonly external_id: string;
  readonly branch: string | null;
  readonly scope: string;
  readonly relation: string;
};

const linkRows = ({ db }: DbParams): Promise<ReadonlyArray<LinkRow>> =>
  db.select<LinkRow>(
    `SELECT session_id, external_id, branch, scope, relation
       FROM session_external_tasks
      ORDER BY session_id, external_id`,
  );

const nullBranchCount = async ({ db }: DbParams): Promise<number> => {
  const rows = await db.select<{ readonly n: number }>(
    'SELECT COUNT(*) AS n FROM session_external_tasks WHERE branch IS NULL',
  );
  return rows[0]?.n ?? -1;
};

type InsertLinkParams = DbParams & {
  readonly scope: 'session' | 'branch';
  readonly branch: string;
};

const insertLink = ({ db, scope, branch }: InsertLinkParams) =>
  db.execute(
    `INSERT INTO session_external_tasks
       (session_id, branch, scope, provider, external_id, identifier, url, title, created_at)
     VALUES ('s-0', ?, ?, 'linear', 'lin-umbrella', 'HBL-400', 'https://linear.app/x/HBL-400', 'Payments revamp', ?)`,
    [branch, scope, NOW],
  );

describe('m216 task links scope', () => {
  it('recovers the branch of the 24 links written at session creation and keeps the rest', async () => {
    const db = await seedPre016();
    const before = await db.select<Pick<LinkRow, 'external_id' | 'branch'>>(
      'SELECT external_id, branch FROM session_external_tasks',
    );
    expect(before).toHaveLength(48);
    expect(await nullBranchCount({ db })).toBe(24);

    await migrate(db, migrations);

    const after = await linkRows({ db });
    expect(after).toHaveLength(48);
    expect(await nullBranchCount({ db })).toBe(0);
    const recovered = after.filter(
      (row) => before.find((old) => old.external_id === row.external_id)?.branch == null,
    );
    expect(recovered).toHaveLength(24);
    expect(recovered.find((row) => row.external_id === 'lin-3-1')?.branch).toBe('hl/payments-3');
    expect(recovered.find((row) => row.external_id === 'lin-3-3')?.branch).toBe('hl/ledger-3');
    expect(after.find((row) => row.external_id === 'lin-3-0')?.branch).toBe('hl/linked-3');
    expect(new Set(after.map((row) => row.scope))).toEqual(new Set(['session']));
    expect(new Set(after.map((row) => row.relation))).toEqual(new Set(['closes']));
  });

  it('leaves a link without any worktree to recover from untouched', async () => {
    const db = await seedPre016();
    await db.execute("DELETE FROM session_worktrees WHERE session_id = 's-5'");

    await migrate(db, migrations);

    const rows = (await linkRows({ db })).filter((row) => row.session_id === 's-5');
    expect(rows.map((row) => row.branch)).toEqual(['hl/linked-5', null, 'hl/linked-5', null]);
  });

  it('lets a session link and a branch link of the same task live side by side, once each', async () => {
    const db = await seedPre016();
    await migrate(db, migrations);

    await insertLink({ db, scope: 'session', branch: 'hl/payments-0' });
    await insertLink({ db, scope: 'branch', branch: 'hl/payments-0' });
    await insertLink({ db, scope: 'branch', branch: 'hl/ledger-0' });

    await expect(insertLink({ db, scope: 'branch', branch: 'hl/payments-0' })).rejects.toThrow(
      /UNIQUE/,
    );
    await expect(insertLink({ db, scope: 'session', branch: 'hl/ledger-0' })).rejects.toThrow(
      /UNIQUE/,
    );
    const umbrella = await db.select<{ readonly scope: string; readonly branch: string }>(
      "SELECT scope, branch FROM session_external_tasks WHERE external_id = 'lin-umbrella' ORDER BY scope, branch",
    );
    expect(umbrella).toEqual([
      { scope: 'branch', branch: 'hl/ledger-0' },
      { scope: 'branch', branch: 'hl/payments-0' },
      { scope: 'session', branch: 'hl/payments-0' },
    ]);
  });

  it('refuses a scope or a relation outside the two it knows', async () => {
    const db = await seedPre016();
    await migrate(db, migrations);

    await expect(
      db.execute(
        "UPDATE session_external_tasks SET scope = 'workspace' WHERE external_id = 'lin-0-0'",
      ),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db.execute(
        "UPDATE session_external_tasks SET relation = 'fixes' WHERE external_id = 'lin-0-0'",
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('recreates only the identity index and keeps the search triggers on the table', async () => {
    const db = await seedPre016();
    const triggersBefore = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'session_external_tasks' ORDER BY name",
    );

    await migrate(db, migrations);

    const triggersAfter = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'session_external_tasks' ORDER BY name",
    );
    expect(triggersAfter).toEqual(triggersBefore);
    const index = await db.select<{ readonly sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_session_external_tasks_identity'",
    );
    expect(index[0]?.sql).toContain("CASE scope WHEN 'branch' THEN branch END");
  });

  it('keeps a task searchable while another link of it remains', async () => {
    const db = await seedPre016();
    await migrate(db, migrations);
    await insertLink({ db, scope: 'session', branch: 'hl/payments-0' });
    await insertLink({ db, scope: 'branch', branch: 'hl/payments-0' });
    const docs = () =>
      db.select<{ readonly id: string }>(
        "SELECT id FROM search_docs WHERE id = 'task:s-0:linear:lin-umbrella'",
      );
    expect(await docs()).toHaveLength(1);

    await db.execute(
      "DELETE FROM session_external_tasks WHERE external_id = 'lin-umbrella' AND scope = 'branch'",
    );
    expect(await docs()).toHaveLength(1);

    await db.execute("DELETE FROM session_external_tasks WHERE external_id = 'lin-umbrella'");
    expect(await docs()).toHaveLength(0);
  });

  it('adds an empty branch template to every workspace and project', async () => {
    const db = await seedPre016();
    await migrate(db, migrations);

    const workspaces = await db.select<{ readonly default_branch_template: string | null }>(
      'SELECT default_branch_template FROM workspaces',
    );
    const projects = await db.select<{ readonly default_branch_template: string | null }>(
      'SELECT default_branch_template FROM projects',
    );
    expect(workspaces).toEqual([{ default_branch_template: null }]);
    expect(projects).toEqual([
      { default_branch_template: null },
      { default_branch_template: null },
    ]);
  });

  it('drops the workspace tasks with their workspace', async () => {
    const db = await seedPre016();
    await migrate(db, migrations);
    await db.execute(
      `INSERT INTO workspace_external_tasks (workspace_id, provider, external_id, identifier, url, title, created_at)
       VALUES ('harborline', 'linear', 'lin-400', 'HBL-400', 'https://linear.app/x/HBL-400', 'Payments revamp', ?)`,
      [NOW],
    );
    await db.execute('PRAGMA foreign_keys = ON');

    await db.execute("DELETE FROM workspaces WHERE id = 'harborline'");

    expect(await db.select('SELECT * FROM workspace_external_tasks')).toEqual([]);
  });
});
