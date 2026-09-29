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

const seedThrough91 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 91 });
  await insertRow({
    db,
    table: 'workspaces',
    row: {
      id: 'workspace-1',
      name: 'Acme',
      root_path: '/fixture/acme',
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
  const workflows: ReadonlyArray<Row> = [
    {
      id: 'workflow-live',
      workspace_id: 'workspace-1',
      name: 'Review',
      description: 'Review the change',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-04-02T10:00:00.000Z',
      is_preset: 0,
      goal: 'Ship it',
      process_text: 'Read then decide',
    },
    {
      id: 'workflow-deleted',
      workspace_id: 'workspace-1',
      name: 'Old flow',
      created_at: '2026-03-01T10:00:00.000Z',
      updated_at: '2026-03-02T10:00:00.000Z',
      deleted_at: NOW - 100,
    },
  ];
  for (const row of workflows) {
    await insertRow({ db, table: 'workflows', row });
  }
  await insertRow({
    db,
    table: 'steps',
    row: { id: 'step-1', workflow_id: 'workflow-live', ordinal: 0, name: 'Read', effort: 'low' },
  });
  await insertRow({
    db,
    table: 'session_workflows',
    row: {
      workflow_run_id: 'run-1',
      session_id: 'session-1',
      workflow_id: 'workflow-live',
      ordinal: 0,
      current_step_ordinal: 1,
      created_at: '2026-04-03T10:00:00.000Z',
    },
  });
  return db;
};

describe('m092 live workflow name uniqueness', () => {
  it('keeps every workflow column, including goal, process text and soft deletes', async () => {
    const db = await seedThrough91();
    const before = await selectRows({ db, table: 'workflows', orderBy: 'id' });

    await migrateThrough({ db, version: 92 });

    expect(before).toHaveLength(2);
    expect(await selectRows({ db, table: 'workflows', orderBy: 'id' })).toEqual(before);
  });

  it('keeps the steps and runs that hang off a rebuilt workflow', async () => {
    const db = await seedThrough91();
    const steps = await selectRows({ db, table: 'steps', orderBy: 'id' });
    const runs = await selectRows({ db, table: 'session_workflows', orderBy: 'workflow_run_id' });

    await migrateThrough({ db, version: 92 });

    expect(steps).toHaveLength(1);
    expect(runs).toHaveLength(1);
    expect(await selectRows({ db, table: 'steps', orderBy: 'id' })).toEqual(steps);
    expect(
      await selectRows({ db, table: 'session_workflows', orderBy: 'workflow_run_id' }),
    ).toEqual(runs);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('lets a deleted workflow share a live name and still rejects two live ones', async () => {
    const db = await seedThrough91();
    await migrateThrough({ db, version: 92 });

    await insertRow({
      db,
      table: 'workflows',
      row: {
        id: 'workflow-reused-name',
        workspace_id: 'workspace-1',
        name: 'Review',
        deleted_at: NOW,
      },
    });

    await expect(
      insertRow({
        db,
        table: 'workflows',
        row: { id: 'workflow-second-live', workspace_id: 'workspace-1', name: 'Review' },
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('still cascades a workflow delete into its steps and runs', async () => {
    const db = await seedThrough91();
    await migrateThrough({ db, version: 92 });

    await db.execute("DELETE FROM workflows WHERE id = 'workflow-live'");
    const left = await db.select<{ readonly total: number }>(
      `SELECT (SELECT COUNT(*) FROM steps) + (SELECT COUNT(*) FROM session_workflows) AS total`,
    );

    expect(left).toEqual([{ total: 0 }]);
  });
});
