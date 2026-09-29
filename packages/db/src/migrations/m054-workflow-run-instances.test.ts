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

const insertAll = async ({
  db,
  table,
  rows,
}: {
  readonly db: Database;
  readonly table: string;
  readonly rows: ReadonlyArray<Row>;
}): Promise<void> => {
  for (const row of rows) {
    await insertRow({ db, table, row });
  }
};

const seedThrough53 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 53 });
  await insertRow({
    db,
    table: 'workspaces',
    row: {
      id: 'workspace-1',
      name: 'Harborline',
      root_path: '/fixture/harborline',
      created_at: NOW,
      updated_at: NOW,
    },
  });
  await insertAll({
    db,
    table: 'sessions',
    rows: [
      {
        id: 'session-auto',
        workspace_id: 'workspace-1',
        goal: 'Auto',
        state_kind: 'idle',
        auto_run: 1,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: 'session-manual',
        workspace_id: 'workspace-1',
        goal: 'Manual',
        state_kind: 'idle',
        auto_run: 0,
        created_at: NOW,
        updated_at: NOW,
      },
    ],
  });
  await insertAll({
    db,
    table: 'workflows',
    rows: [
      { id: 'workflow-a', workspace_id: 'workspace-1', name: 'Plan and build' },
      { id: 'workflow-b', workspace_id: 'workspace-1', name: 'Review' },
    ],
  });
  await insertAll({
    db,
    table: 'steps',
    rows: [
      { id: 'step-a', workflow_id: 'workflow-a', ordinal: 0, name: 'Plan' },
      { id: 'step-b', workflow_id: 'workflow-b', ordinal: 0, name: 'Review' },
    ],
  });
  await insertAll({
    db,
    table: 'session_workflows',
    rows: [
      {
        session_id: 'session-auto',
        workflow_id: 'workflow-a',
        ordinal: 0,
        current_step_ordinal: 2,
        created_at: '2026-04-01 10:00:00',
      },
      {
        session_id: 'session-auto',
        workflow_id: 'workflow-b',
        ordinal: 1,
        current_step_ordinal: 0,
        created_at: '2026-04-02 10:00:00',
        discarded_at: '2026-04-03 10:00:00',
      },
      {
        session_id: 'session-manual',
        workflow_id: 'workflow-a',
        ordinal: 0,
        current_step_ordinal: 1,
        created_at: '2026-04-04 10:00:00',
      },
    ],
  });
  await insertAll({
    db,
    table: 'agents',
    rows: [
      {
        id: 'agent-a',
        session_id: 'session-auto',
        step_id: 'step-a',
        ordinal: 0,
        name: 'Planner',
        status: 'done',
        output_summary: 'planned',
      },
      {
        id: 'agent-b',
        session_id: 'session-auto',
        step_id: 'step-b',
        ordinal: 1,
        name: 'Reviewer',
        status: 'running',
      },
      {
        id: 'agent-manual',
        session_id: 'session-manual',
        step_id: 'step-a',
        ordinal: 0,
        name: 'Planner',
        status: 'done',
      },
      { id: 'agent-free', session_id: 'session-auto', ordinal: 2, name: 'Chat', status: 'done' },
    ],
  });
  await insertAll({
    db,
    table: 'session_plans',
    rows: [
      {
        id: 'plan-a',
        session_id: 'session-auto',
        agent_id: 'agent-a',
        title: 'Plan A',
        body_md: '# A',
        status: 'active',
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: 'plan-free',
        session_id: 'session-auto',
        agent_id: 'agent-free',
        title: 'Free',
        body_md: '# F',
        status: 'consumed',
        created_at: NOW,
        updated_at: NOW,
      },
    ],
  });
  await insertAll({
    db,
    table: 'open_questions',
    rows: [
      {
        id: 'question-b',
        session_id: 'session-auto',
        workflow_id: 'workflow-b',
        text: 'B?',
        created_at: NOW,
      },
      {
        id: 'question-a',
        session_id: 'session-auto',
        workflow_id: 'workflow-a',
        text: 'A?',
        created_at: NOW,
      },
      {
        id: 'question-manual',
        session_id: 'session-manual',
        workflow_id: 'workflow-a',
        text: 'Manual?',
        created_at: NOW,
      },
      { id: 'question-none', session_id: 'session-manual', text: 'None?', created_at: NOW },
    ],
  });
  return db;
};

const withoutRunColumns = (row: Row): Row =>
  Object.fromEntries(
    Object.entries(row).filter(([name]) => name !== 'workflow_run_id' && name !== 'auto_run'),
  );

type RunRow = {
  readonly workflow_run_id: string;
  readonly session_id: string;
  readonly workflow_id: string;
};

const runIdOf = ({
  runs,
  session,
  workflow,
}: {
  readonly runs: ReadonlyArray<RunRow>;
  readonly session: string;
  readonly workflow: string;
}): string | undefined =>
  runs.find((run) => run.session_id === session && run.workflow_id === workflow)?.workflow_run_id;

describe('m054 workflow run instances', () => {
  it('gives every session workflow a unique run id and keeps its other columns', async () => {
    const db = await seedThrough53();
    const before = await selectRows({
      db,
      table: 'session_workflows',
      orderBy: 'session_id, ordinal',
    });

    await migrateThrough({ db, version: 54 });
    const after = await selectRows({
      db,
      table: 'session_workflows',
      orderBy: 'session_id, ordinal',
    });

    expect(before).toHaveLength(3);
    expect(after.every((row) => /^[0-9a-f]{32}$/.test(String(row['workflow_run_id'])))).toBe(true);
    expect(new Set(after.map((row) => row['workflow_run_id'])).size).toBe(3);
    expect(after.map(withoutRunColumns)).toEqual(before);
  });

  it('copies auto_run from the session onto each run', async () => {
    const db = await seedThrough53();

    await migrateThrough({ db, version: 54 });
    const runs = await db.select<Row>(
      'SELECT session_id, workflow_id, auto_run FROM session_workflows ORDER BY session_id, ordinal',
    );

    expect(runs).toEqual([
      { session_id: 'session-auto', workflow_id: 'workflow-a', auto_run: 1 },
      { session_id: 'session-auto', workflow_id: 'workflow-b', auto_run: 1 },
      { session_id: 'session-manual', workflow_id: 'workflow-a', auto_run: 0 },
    ]);
  });

  it('links each agent to the run of its step workflow and leaves step-less agents alone', async () => {
    const db = await seedThrough53();
    const before = await selectRows({ db, table: 'agents', orderBy: 'id' });

    await migrateThrough({ db, version: 54 });
    const runs = await db.select<RunRow>(
      'SELECT workflow_run_id, session_id, workflow_id FROM session_workflows',
    );
    const after = await selectRows({ db, table: 'agents', orderBy: 'id' });

    expect(after).toEqual(
      before.map((row) => ({
        ...row,
        workflow_run_id: {
          'agent-a': runIdOf({ runs, session: 'session-auto', workflow: 'workflow-a' }),
          'agent-b': runIdOf({ runs, session: 'session-auto', workflow: 'workflow-b' }),
          'agent-manual': runIdOf({ runs, session: 'session-manual', workflow: 'workflow-a' }),
          'agent-free': null,
        }[String(row['id'])],
      })),
    );
    expect(after.find((row) => row['id'] === 'agent-a')?.['workflow_run_id']).toEqual(
      expect.any(String),
    );
  });

  it('links plans through their agent and open questions through their workflow', async () => {
    const db = await seedThrough53();
    const plansBefore = await selectRows({ db, table: 'session_plans', orderBy: 'id' });
    const questionsBefore = await selectRows({ db, table: 'open_questions', orderBy: 'id' });

    await migrateThrough({ db, version: 54 });
    const runs = await db.select<RunRow>(
      'SELECT workflow_run_id, session_id, workflow_id FROM session_workflows',
    );
    const runA = runIdOf({ runs, session: 'session-auto', workflow: 'workflow-a' });
    const runB = runIdOf({ runs, session: 'session-auto', workflow: 'workflow-b' });
    const runManual = runIdOf({ runs, session: 'session-manual', workflow: 'workflow-a' });

    expect(await selectRows({ db, table: 'session_plans', orderBy: 'id' })).toEqual(
      plansBefore.map((row) => ({ ...row, workflow_run_id: row['id'] === 'plan-a' ? runA : null })),
    );
    expect(await selectRows({ db, table: 'open_questions', orderBy: 'id' })).toEqual(
      questionsBefore.map((row) => ({
        ...row,
        workflow_run_id: {
          'question-a': runA,
          'question-b': runB,
          'question-manual': runManual,
          'question-none': null,
        }[String(row['id'])],
      })),
    );
    expect(runA).not.toBe(runB);
  });

  it('keeps the steps and workflows and leaves no dangling foreign key', async () => {
    const db = await seedThrough53();
    const steps = await selectRows({ db, table: 'steps', orderBy: 'id' });
    const workflows = await selectRows({ db, table: 'workflows', orderBy: 'id' });

    await migrateThrough({ db, version: 54 });

    expect(await selectRows({ db, table: 'steps', orderBy: 'id' })).toEqual(steps);
    expect(await selectRows({ db, table: 'workflows', orderBy: 'id' })).toEqual(workflows);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });
});
