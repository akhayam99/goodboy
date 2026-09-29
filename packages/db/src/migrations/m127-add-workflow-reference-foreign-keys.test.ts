import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  foreignKeyViolations,
  insertRow,
  migrateThrough,
  selectRows,
  type Row,
} from '../test-helpers/migration-rows';

const NOW = 1_775_000_000_000;

const question = (fields: Row): Row => ({
  id: 'question',
  session_id: 'session-1',
  workflow_id: 'workflow-1',
  created_by_step_ordinal: 1,
  owned_by_step_ordinal: 2,
  text: 'Which account?',
  suggested_answers: '["a","b"]',
  user_answer: null,
  status: 'open',
  created_at: NOW,
  answered_at: null,
  dismissed_at: null,
  created_by_agent_id: 'agent-1',
  workflow_run_id: null,
  turn_ordinal: 4,
  recommended_answer: 'a',
  select_mode: 'one',
  ...fields,
});

const plan = (fields: Row): Row => ({
  id: 'plan',
  session_id: 'session-1',
  agent_id: 'agent-1',
  title: 'Plan',
  body_md: '# Steps',
  status: 'active',
  created_at: NOW,
  updated_at: NOW + 1,
  clusters_json: '[{"id":"c1"}]',
  workflow_run_id: null,
  ...fields,
});

const version = (fields: Row): Row => ({
  id: 'version',
  session_id: 'session-1',
  relative_path: 'src/ledger.ts',
  stored_name: 'stored',
  size_bytes: 128,
  content_hash: 'hash',
  change_kind: 'modified',
  snapshot_source: 'agent_turn',
  provider_run_id: null,
  captured_at: NOW,
  ...fields,
});

const seedThrough126 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 126 });
  await insertRow({
    db,
    table: 'workspaces',
    row: {
      id: 'workspace-1',
      name: 'Cascadia',
      slug: 'cascadia',
      created_at: NOW,
      updated_at: NOW,
    },
  });
  await insertRow({
    db,
    table: 'sessions',
    row: {
      id: 'session-1',
      workspace_id: 'workspace-1',
      goal: 'Goal',
      state_kind: 'idle',
      created_at: NOW,
      updated_at: NOW,
    },
  });
  await insertRow({
    db,
    table: 'workflows',
    row: {
      id: 'workflow-1',
      workspace_id: 'workspace-1',
      name: 'Flow',
      created_at: NOW,
      updated_at: NOW,
    },
  });
  await insertRow({
    db,
    table: 'session_workflows',
    row: {
      workflow_run_id: 'run-live',
      session_id: 'session-1',
      workflow_id: 'workflow-1',
      ordinal: 0,
      created_at: NOW,
    },
  });
  await insertRow({
    db,
    table: 'agents',
    row: { id: 'agent-1', session_id: 'session-1', ordinal: 0, name: 'Agent', status: 'done' },
  });
  await insertRow({
    db,
    table: 'provider_runs',
    row: {
      id: 'provider-run-live',
      session_id: 'session-1',
      provider: 'codex',
      model: 'model',
      status_kind: 'succeeded',
      status_payload: '{}',
      created_at: NOW,
    },
  });
  const questions: ReadonlyArray<Row> = [
    question({ id: 'question-live', text: 'Live?', workflow_run_id: 'run-live' }),
    question({ id: 'question-gone', text: 'Gone?', workflow_run_id: 'run-gone' }),
    question({
      id: 'question-none',
      text: 'None?',
      status: 'answered',
      user_answer: 'b',
      answered_at: NOW + 5,
      select_mode: 'many',
    }),
  ];
  for (const row of questions) {
    await insertRow({ db, table: 'open_questions', row });
  }
  const plans: ReadonlyArray<Row> = [
    plan({ id: 'plan-live', workflow_run_id: 'run-live' }),
    plan({ id: 'plan-gone', status: 'superseded', workflow_run_id: 'run-gone' }),
    plan({ id: 'plan-none', status: 'consumed', clusters_json: null }),
  ];
  for (const row of plans) {
    await insertRow({ db, table: 'session_plans', row });
  }
  const versions: ReadonlyArray<Row> = [
    version({ id: 'version-live', provider_run_id: 'provider-run-live' }),
    version({
      id: 'version-gone',
      change_kind: 'deleted',
      snapshot_source: 'restore',
      provider_run_id: 'provider-run-gone',
    }),
    version({ id: 'version-none', relative_path: 'src/other.ts', stored_name: 'stored-2' }),
  ];
  for (const row of versions) {
    await insertRow({ db, table: 'file_versions', row });
  }
  return db;
};

type Rebuilt = {
  readonly table: string;
  readonly orderBy: string;
  readonly column: string;
  readonly live: string;
  readonly gone: string;
  readonly liveReference: string;
};

const REBUILT: ReadonlyArray<Rebuilt> = [
  {
    table: 'open_questions',
    orderBy: 'id',
    column: 'workflow_run_id',
    live: 'question-live',
    gone: 'question-gone',
    liveReference: 'run-live',
  },
  {
    table: 'session_plans',
    orderBy: 'id',
    column: 'workflow_run_id',
    live: 'plan-live',
    gone: 'plan-gone',
    liveReference: 'run-live',
  },
  {
    table: 'file_versions',
    orderBy: 'id',
    column: 'provider_run_id',
    live: 'version-live',
    gone: 'version-gone',
    liveReference: 'provider-run-live',
  },
];

describe('m127 workflow reference foreign keys', () => {
  it.each(REBUILT)(
    'keeps every $table column, nulls only the dangling reference',
    async ({ table, orderBy, column, gone }) => {
      const db = await seedThrough126();
      const before = await selectRows({ db, table, orderBy });

      await migrateThrough({ db, version: 127 });
      const after = await selectRows({ db, table, orderBy });

      expect(before).toHaveLength(3);
      expect(after).toEqual(
        before.map((row) => (row['id'] === gone ? { ...row, [column]: null } : row)),
      );
    },
  );

  it.each(REBUILT)(
    'keeps the live reference of $live',
    async ({ table, column, live, liveReference }) => {
      const db = await seedThrough126();

      await migrateThrough({ db, version: 127 });
      const rows = await db.select<Row>(
        `SELECT ${column} AS reference FROM ${table} WHERE id = ?`,
        [live],
      );

      expect(rows).toEqual([{ reference: liveReference }]);
    },
  );

  it('now clears the reference when the referenced run is deleted', async () => {
    const db = await seedThrough126();

    await migrateThrough({ db, version: 127 });
    await db.execute("DELETE FROM session_workflows WHERE workflow_run_id = 'run-live'");
    await db.execute("DELETE FROM provider_runs WHERE id = 'provider-run-live'");
    const references = await db.select<Row>(
      `SELECT
         (SELECT workflow_run_id FROM open_questions WHERE id = 'question-live') AS question_run,
         (SELECT workflow_run_id FROM session_plans WHERE id = 'plan-live') AS plan_run,
         (SELECT provider_run_id FROM file_versions WHERE id = 'version-live') AS version_run`,
    );

    expect(references).toEqual([{ question_run: null, plan_run: null, version_run: null }]);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('keeps the open-question text unique per session', async () => {
    const db = await seedThrough126();

    await migrateThrough({ db, version: 127 });

    await expect(
      insertRow({
        db,
        table: 'open_questions',
        row: question({ id: 'question-copy', text: 'Live?' }),
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });
});
