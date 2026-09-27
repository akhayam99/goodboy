import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-09-26T12:00:00.000Z');

const KINDS_BEFORE_M200 = [
  'worktree_created',
  'branch_created',
  'branch_switched',
  'issue_linked',
  'issue_unlinked',
  'pr_created',
  'pr_discovered',
  'pr_ready',
  'pr_approved',
  'pr_merged',
  'pr_closed',
  'workflow_started',
  'workflow_discarded',
  'workflow_restored',
  'workflow_closed',
  'workflow_deleted',
  'decisions_changed',
  'project_materialized',
  'project_materialization_refused',
  'project_materialization_proposed',
  'project_materialization_dismissed',
  'project_detached',
  'external_task_created',
  'rebase_requested',
  'session_archived',
  'session_restored',
  'write_destination_changed',
  'question_dismissed',
  'question_restored',
] as const;

const seedThrough198 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 198 });
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Harborline', 'harborline', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-1', 'workspace-1', 'Ledger', 'idle', ?, ?)`,
    [NOW, NOW],
  );
  for (const [index, kind] of KINDS_BEFORE_M200.entries()) {
    await db.execute(
      'INSERT INTO session_events (id, session_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
      [`ev-old-${index}`, 'session-1', kind, '{"mountId":"mount-1"}', NOW],
    );
  }
  return db;
};

const insertEvent = async ({
  db,
  id,
  kind,
}: {
  readonly db: Database;
  readonly id: string;
  readonly kind: string;
}): Promise<void> => {
  await db.execute(
    'INSERT INTO session_events (id, session_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, 'session-1', kind, '{"planId":"plan-1"}', NOW],
  );
};

describe('m200 session event history kinds', () => {
  it('keeps every pre-existing kind and accepts the four history outcomes', async () => {
    const db = await seedThrough198();

    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-1', kind: 'history_rewritten' });
    await insertEvent({ db, id: 'ev-2', kind: 'history_pushed' });
    await insertEvent({ db, id: 'ev-3', kind: 'history_stopped' });
    await insertEvent({ db, id: 'ev-4', kind: 'history_restored' });

    const rows = await db.select<{ kind: string }>('SELECT kind FROM session_events');
    const expectedKinds = [
      ...KINDS_BEFORE_M200,
      'history_rewritten',
      'history_pushed',
      'history_stopped',
      'history_restored',
    ];
    expect(
      rows
        .map((row) => row.kind)
        .slice()
        .sort(),
    ).toEqual(expectedKinds.slice().sort());
  });

  it('refuses a history outcome before the rebuild', async () => {
    const db = await seedThrough198();

    await expect(insertEvent({ db, id: 'ev-early', kind: 'history_stopped' })).rejects.toThrow();
  });
});
