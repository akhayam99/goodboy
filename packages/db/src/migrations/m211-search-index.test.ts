import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { SEARCH_WORLD, seedSearchWorld } from '../test-helpers/search-fixtures';
import { migrations } from './index';
import { migrate } from './runner';

type DocRow = {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
};

const docs = async ({ db }: { readonly db: Database }): Promise<ReadonlyArray<DocRow>> =>
  db.select<DocRow>(
    `SELECT d.id, d.kind, f.title, f.body FROM search_docs d
     JOIN search_index f ON f.rowid = d.fts_rowid ORDER BY d.id`,
  );

const matching = async ({
  db,
  query,
}: {
  readonly db: Database;
  readonly query: string;
}): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ id: string }>(
    `SELECT d.id FROM search_index JOIN search_docs d ON d.fts_rowid = search_index.rowid
     WHERE search_index MATCH ? ORDER BY d.id`,
    [query],
  );
  return rows.map((row) => row.id);
};

const seeded = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await seedSearchWorld({ db });
  return db;
};

const EXPECTED_TRIGGER_TABLES = [
  'sessions',
  'messages',
  'agents',
  'session_artifacts',
  'session_decisions',
  'open_questions',
  'session_external_tasks',
  'workspace_starred_issues',
  'github_pr_cache',
  'mount_pr_links',
  'session_worktrees',
  'workflows',
  'steps',
  'diff_comments',
];

describe('m211 search index', () => {
  it('indexes every source type on insert', async () => {
    const db = await seeded();
    const rows = await docs({ db });
    expect(rows.map((row) => [row.id, row.kind])).toEqual([
      ['agent:a-builder', 'agent'],
      ['agent:a-relay', 'agent'],
      ['artifact:art-plan', 'plan'],
      ['artifact:art-wire', 'wireframe'],
      ['branch:m-ledger', 'branch'],
      ['comment:c-1', 'comment'],
      ['decision:dec-1', 'decision'],
      ['ghpr:harborline/ledger-core:ak/feat-payout-stream', 'pr'],
      ['message:msg-assistant', 'message'],
      ['message:msg-relay', 'message'],
      ['message:msg-user', 'message'],
      ['mountpr:mpr-1', 'pr'],
      ['question:q-1', 'question'],
      ['session:s-payout', 'session'],
      ['session:s-relay', 'session'],
      ['starred:ws-harborline:jira:jira-88', 'issue'],
      ['step:step-scout', 'workflow'],
      ['task:s-payout:linear:lin-231', 'issue'],
      ['workflow:wf-settle', 'workflow'],
    ]);
    expect(
      rows.find((row) => row.id === 'ghpr:harborline/ledger-core:ak/feat-payout-stream'),
    ).toMatchObject({
      title: '#482 Stream the payout export',
    });
  });

  it('never indexes system messages or wireframe json', async () => {
    const db = await seeded();
    expect(await matching({ db, query: 'private' })).toEqual([]);
    expect(await matching({ db, query: 'hidden' })).toEqual([]);
  });

  it('follows updates of the watched columns', async () => {
    const db = await seeded();
    await db.execute("UPDATE messages SET content = 'Batch the ledger rows' WHERE id = 'msg-user'");
    await db.execute(
      "UPDATE sessions SET goal = 'Ship the reconciliation report' WHERE id = 's-payout'",
    );
    await db.execute("UPDATE session_artifacts SET status = 'discarded' WHERE id = 'art-plan'");
    await db.execute("UPDATE agents SET name = 'Reconciler' WHERE id = 'a-builder'");
    await db.execute("UPDATE session_decisions SET why = 'Merchants asked' WHERE id = 'dec-1'");
    await db.execute(
      "UPDATE open_questions SET user_answer = 'Above a threshold' WHERE id = 'q-1'",
    );
    await db.execute(
      "UPDATE workspace_starred_issues SET title = 'Drift fixed' WHERE external_id = 'jira-88'",
    );
    await db.execute(
      "UPDATE session_external_tasks SET title = 'Export fixed' WHERE external_id = 'lin-231'",
    );
    await db.execute(
      `UPDATE github_pr_cache SET pr_json = '{"number":482,"title":"Chunked export","state":"merged"}'`,
    );
    await db.execute("UPDATE mount_pr_links SET state = 'merged' WHERE id = 'mpr-1'");
    await db.execute(
      "UPDATE session_worktrees SET branch = 'ak/feat-chunks' WHERE id = 'm-ledger'",
    );

    expect(await matching({ db, query: 'ledger' })).toContain('message:msg-user');
    expect(await matching({ db, query: 'reconciliation' })).toEqual(['session:s-payout']);
    expect(await matching({ db, query: 'reconciler' })).toEqual(['agent:a-builder']);
    expect(await matching({ db, query: 'asked' })).toEqual(['decision:dec-1']);
    expect(await matching({ db, query: 'threshold' })).toEqual(['question:q-1']);
    expect(await matching({ db, query: 'drift' })).toEqual(['starred:ws-harborline:jira:jira-88']);
    expect(await matching({ db, query: 'fixed' })).toEqual([
      'starred:ws-harborline:jira:jira-88',
      'task:s-payout:linear:lin-231',
    ]);
    expect(await matching({ db, query: 'chunked' })).toEqual([
      'ghpr:harborline/ledger-core:ak/feat-payout-stream',
    ]);
    expect(await matching({ db, query: 'chunks' })).toEqual(['branch:m-ledger']);
    const statuses = await db.select<{ id: string; status: string }>(
      "SELECT id, status FROM search_docs WHERE id IN ('artifact:art-plan', 'mountpr:mpr-1', 'ghpr:harborline/ledger-core:ak/feat-payout-stream') ORDER BY id",
    );
    expect(statuses).toEqual([
      { id: 'artifact:art-plan', status: 'discarded' },
      { id: 'ghpr:harborline/ledger-core:ak/feat-payout-stream', status: 'merged' },
      { id: 'mountpr:mpr-1', status: 'merged' },
    ]);
  });

  it('drops a message that becomes a system message', async () => {
    const db = await seeded();
    await db.execute("UPDATE messages SET role = 'system' WHERE id = 'msg-user'");
    expect(await matching({ db, query: 'lindqvist' })).toEqual([]);
  });

  it('removes docs and index rows on delete, for every type', async () => {
    const db = await seeded();
    await db.exec(`
      DELETE FROM messages WHERE id = 'msg-relay';
      DELETE FROM session_decisions WHERE id = 'dec-1';
      DELETE FROM open_questions WHERE id = 'q-1';
      DELETE FROM session_external_tasks WHERE external_id = 'lin-231';
      DELETE FROM workspace_starred_issues WHERE external_id = 'jira-88';
      DELETE FROM github_pr_cache;
      DELETE FROM mount_pr_links;
      DELETE FROM session_artifacts WHERE id = 'art-plan';
      DELETE FROM steps WHERE id = 'step-scout';
      DELETE FROM workflows WHERE id = 'wf-settle';
      DELETE FROM diff_comments WHERE id = 'c-1';
    `);
    const ids = (await docs({ db })).map((row) => row.id);
    expect(ids).not.toContain('message:msg-relay');
    expect(
      ids.filter((id) =>
        /^(decision|question|task|starred|ghpr|mountpr|workflow|step|comment):/.test(id),
      ),
    ).toEqual([]);
    expect(ids).not.toContain('artifact:art-plan');
    const [orphans] = await db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM search_index WHERE rowid NOT IN (SELECT fts_rowid FROM search_docs)',
    );
    expect(orphans?.count).toBe(0);
  });

  it('cascades a deleted session to every doc it owns', async () => {
    const db = await seeded();
    await db.execute("DELETE FROM sessions WHERE id = 's-payout'");
    const ids = (await docs({ db })).map((row) => row.id);
    expect(ids).toEqual([
      'agent:a-relay',
      'ghpr:harborline/ledger-core:ak/feat-payout-stream',
      'message:msg-relay',
      'session:s-relay',
      'starred:ws-harborline:jira:jira-88',
      'step:step-scout',
      'workflow:wf-settle',
    ]);
    const [count] = await db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM search_index',
    );
    expect(count?.count).toBe(7);
  });

  it('cascades a deleted workspace to its starred issues', async () => {
    const db = await seeded();
    await db.execute(`DELETE FROM workspaces WHERE id = '${SEARCH_WORLD.workspaceId}'`);
    const ids = (await docs({ db })).map((row) => row.id);
    expect(ids.some((id) => id.startsWith('starred:'))).toBe(false);
  });

  it('survives an upsert that replaces a row', async () => {
    const db = await seeded();
    await db.execute(
      `INSERT OR REPLACE INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at)
       VALUES ('ak/feat-payout-stream', 'harborline/ledger-core', '{"number":482,"title":"Replaced title","state":"open"}', 1)`,
    );
    expect(await matching({ db, query: 'replaced' })).toEqual([
      'ghpr:harborline/ledger-core:ak/feat-payout-stream',
    ]);
    const [count] = await db.select<{ count: number }>(
      "SELECT COUNT(*) AS count FROM search_docs WHERE kind = 'pr' AND container = 'harborline/ledger-core' AND ref_id = 'ak/feat-payout-stream'",
    );
    expect(count?.count).toBe(1);
  });

  it('never fails the source write on malformed json', async () => {
    const db = await seeded();
    await db.execute(
      "INSERT INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at) VALUES ('b', 'r', 'not json', 1)",
    );
    await db.execute("UPDATE mount_pr_links SET snapshot_json = 'not json' WHERE id = 'mpr-1'");
    const ids = (await docs({ db })).map((row) => row.id);
    expect(ids).not.toContain('ghpr:r:b');
    expect(ids).toContain('mountpr:mpr-1');
  });

  it('matches prefixes and ignores diacritics', async () => {
    const db = await seeded();
    await db.execute(
      "UPDATE messages SET content = 'Tomás asked for the café export' WHERE id = 'msg-relay'",
    );
    expect(await matching({ db, query: 'tomas' })).toEqual(['message:msg-relay']);
    expect(await matching({ db, query: 'caf*' })).toEqual(['message:msg-relay']);
  });

  it('keeps its triggers on every indexed table in the latest schema', async () => {
    const db = await makeMigratedTestDatabase();
    const rows = await db.select<{ tbl_name: string }>(
      "SELECT DISTINCT tbl_name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'search_%' ORDER BY tbl_name",
    );
    expect(rows.map((row) => row.tbl_name)).toEqual(
      [...EXPECTED_TRIGGER_TABLES, 'search_docs'].sort(),
    );
    const [count] = await db.select<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'search_%'",
    );
    expect(count?.count).toBe(EXPECTED_TRIGGER_TABLES.length * 3 + 1);
  });

  it('upgrades a database with existing rows without indexing them', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 210 });
    await db.exec(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w', 'Harborline', 'harborline', 1, 1);
      INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('s', 'w', 'Old goal', 'idle', 1, 1);
    `);
    await migrate(db, migrations);
    expect(await docs({ db })).toEqual([]);
    await db.execute("UPDATE sessions SET goal = 'Payout export' WHERE id = 's'");
    expect((await docs({ db })).map((row) => row.id)).toEqual(['session:s']);
  });
});
