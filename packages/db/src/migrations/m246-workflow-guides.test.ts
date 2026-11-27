import { describe, expect, it } from 'vitest';
import { brandId, type AutoTreeId, type WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { getAutoTree } from '../queries/auto-trees';
import { listWorkspaceTurnSpans } from '../queries/agent-turn-span';
import { getWorkflow, listWorkflows } from '../queries/workflow';
import { listWorkspaceWorkflowRuns } from '../queries/workflow-run-history';
import {
  AUTO_SEED_NOW,
  AUTO_SEED_ROOT,
  seedAutoSession,
  seedAutoTree,
} from '../test-helpers/auto-seeds';
import {
  foreignKeyViolations,
  insertRow,
  migrateThrough,
  selectRows,
  type Row,
} from '../test-helpers/migration-rows';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { DatabaseFromNewerBuildError } from './downgradeGuard';
import { migrations } from './index';
import { migrate } from './runner';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const GUIDE_COLUMNS = ['entry_check', 'stop_rule', 'then_suggest_id', 'is_order_kept'];

type DatabaseParams = {
  readonly db: Database;
};

const seedAt245 = async ({ db }: DatabaseParams): Promise<void> => {
  await seedAutoSession({ db });
  await seedAutoTree({ db });
  await insertRow({
    db,
    table: 'workflows',
    row: {
      id: 'wf_seed_fix-a-bug_workspace-harborline',
      workspace_id: WORKSPACE,
      name: 'Fix a bug',
      description: 'Investigate a bug, fix the root cause, and add regression tests.',
      created_at: AUTO_SEED_NOW,
      updated_at: AUTO_SEED_NOW,
      is_preset: 1,
      origin: 'library',
    },
  });
  await insertRow({
    db,
    table: 'workflows',
    row: {
      id: 'wf-harborline-release',
      workspace_id: WORKSPACE,
      name: 'Harborline release',
      description: 'Cutting a payments-api release.',
      process_text: 'Check main, tag, publish.',
      created_at: AUTO_SEED_NOW + 1,
      updated_at: AUTO_SEED_NOW + 1,
      is_preset: 1,
      origin: 'custom',
    },
  });
  await insertRow({
    db,
    table: 'agent_turn_spans',
    row: {
      run_id: 'run-lead-1',
      agent_id: AUTO_SEED_ROOT,
      session_id: 'session-harborline',
      workspace_id: WORKSPACE,
      step_role: 'auto',
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      started_at: AUTO_SEED_NOW,
      ended_at: AUTO_SEED_NOW + 1_000,
      end_reason: 'succeeded',
      cost_usd: 0.12,
    },
  });
};

type RowParams = {
  readonly row: Row;
};

const withoutGuide = ({ row }: RowParams): Row =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !GUIDE_COLUMNS.includes(key)));

const withoutTreeGuide = ({ row }: RowParams): Row =>
  Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'guide'));

describe('m246 workflow guides', () => {
  it('keeps every workflow, tree and turn of a 245 database and fills the new columns with defaults', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 245 });
    await seedAt245({ db });
    const workflowsBefore = await selectRows({ db, table: 'workflows', orderBy: 'id' });
    const treesBefore = await selectRows({ db, table: 'auto_trees', orderBy: 'id' });
    const spansBefore = await selectRows({ db, table: 'agent_turn_spans', orderBy: 'run_id' });

    const result = await migrateThrough({ db, version: 246 });

    expect(result.applied).toEqual([246]);
    const workflowsAfter = await selectRows({ db, table: 'workflows', orderBy: 'id' });
    expect(workflowsAfter.map((row) => withoutGuide({ row }))).toEqual(workflowsBefore);
    expect(workflowsAfter.map((row) => GUIDE_COLUMNS.map((column) => row[column] ?? null))).toEqual(
      [
        [null, null, null, 0],
        [null, null, null, 0],
      ],
    );
    const treesAfter = await selectRows({ db, table: 'auto_trees', orderBy: 'id' });
    expect(treesAfter.map((row) => withoutTreeGuide({ row }))).toEqual(treesBefore);
    expect(treesAfter.map((row) => row.guide)).toEqual([null]);
    expect(await selectRows({ db, table: 'agent_turn_spans', orderBy: 'run_id' })).toEqual(
      spansBefore,
    );
    expect(await selectRows({ db, table: 'agent_turn_picks', orderBy: 'run_id' })).toEqual([]);
    expect(await foreignKeyViolations(db)).toEqual([]);
  });

  it('boots on the upgraded database: the reads the app runs at start answer', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 245 });
    await seedAt245({ db });
    await migrateThrough({ db, version: 246 });

    expect(await migrateThrough({ db, version: 246 })).toMatchObject({ applied: [] });
    const workflows = await listWorkflows(db, WORKSPACE);
    expect(workflows.map((workflow) => workflow.name)).toEqual(['Fix a bug', 'Harborline release']);
    expect(workflows[1]?.processText).toBe('Check main, tag, publish.');
    expect(workflows[1]?.entryCheck).toBeUndefined();
    expect(await listWorkspaceWorkflowRuns({ db, workspaceId: WORKSPACE })).toEqual([]);
    expect(
      await getAutoTree({ db, treeId: brandId<AutoTreeId>({ value: 'tree-1' }) }),
    ).not.toBeNull();
    expect(await listWorkspaceTurnSpans({ db, workspaceId: WORKSPACE, sinceMs: 0 })).toHaveLength(
      1,
    );
  });

  it('takes a pick only for a turn that has a span, from the closed list, and drops it with the span', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute('PRAGMA foreign_keys = ON');
    await seedAt245({ db });

    const pick = ({ row }: RowParams) =>
      insertRow({
        db,
        table: 'agent_turn_picks',
        row: { created_at: AUTO_SEED_NOW, updated_at: AUTO_SEED_NOW, ...row },
      });

    await expect(
      pick({ row: { id: 'p1', run_id: 'run-unknown', source: 'lead' } }),
    ).rejects.toThrow();
    await expect(
      pick({ row: { id: 'p2', run_id: 'run-lead-1', source: 'auto' } }),
    ).rejects.toThrow();
    await pick({ row: { id: 'p3', run_id: 'run-lead-1', source: 'pinned' } });
    await expect(
      pick({ row: { id: 'p4', run_id: 'run-lead-1', source: 'lead' } }),
    ).rejects.toThrow();
    await db.execute("DELETE FROM agent_turn_spans WHERE run_id = 'run-lead-1'");

    expect(await selectRows({ db, table: 'agent_turn_picks', orderBy: 'run_id' })).toEqual([]);
  });

  it('refuses a tree record that is not JSON and a keep order that is not 0 or 1', async () => {
    const db = await makeMigratedTestDatabase();
    await seedAt245({ db });

    await expect(
      db.execute("UPDATE auto_trees SET guide = 'Fix a bug' WHERE id = 'tree-1'"),
    ).rejects.toThrow();
    await expect(
      db.execute("UPDATE workflows SET is_order_kept = 2 WHERE id = 'wf-harborline-release'"),
    ).rejects.toThrow();
    await db.execute(
      `UPDATE auto_trees SET guide = '{"workflowId":"wf-harborline-release"}' WHERE id = 'tree-1'`,
    );
    const workflow = await getWorkflow(db, brandId({ value: 'wf-harborline-release' }));
    expect(workflow?.isOrderKept).toBeUndefined();
  });

  it('is refused by an older build, which offers the backup instead', async () => {
    const db = await makeMigratedTestDatabase();
    const olderBuild = migrations.filter((migration) => migration.version < 246);
    const failure = await migrate(db, olderBuild).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DatabaseFromNewerBuildError);
  });
});
