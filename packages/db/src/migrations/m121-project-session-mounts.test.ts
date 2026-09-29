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

const seedThrough120 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 120 });
  await insertRow({
    db,
    table: 'workspaces',
    row: {
      id: 'workspace-northwind',
      name: 'Northwind',
      slug: 'northwind',
      created_at: NOW,
      updated_at: NOW,
    },
  });
  for (const name of ['payments-api', 'storefront-web']) {
    await insertRow({
      db,
      table: 'projects',
      row: {
        id: `project-${name}`,
        workspace_id: 'workspace-northwind',
        name,
        root_path: `/fixture/${name}`,
        kind: 'repo',
        created_at: NOW,
        updated_at: NOW,
      },
    });
  }
  await insertRow({
    db,
    table: 'sessions',
    row: {
      id: 'session-checkout',
      workspace_id: 'workspace-northwind',
      goal: 'Checkout',
      state_kind: 'idle',
      created_at: NOW,
      updated_at: NOW,
    },
  });
  await insertRow({
    db,
    table: 'sessions',
    row: {
      id: 'session-refunds',
      workspace_id: 'workspace-northwind',
      goal: 'Refunds',
      state_kind: 'idle',
      created_at: NOW,
      updated_at: NOW,
    },
  });
  const worktrees: ReadonlyArray<Row> = [
    {
      id: 'worktree-api',
      session_id: 'session-checkout',
      worktree_path: '/worktrees/checkout/payments-api',
      branch: 'ak/checkout',
      parallel_index: 0,
      created_at: NOW - 30,
      mount_workspace_id: 'project-payments-api',
      mount_name: 'payments-api',
      repo_slug: 'northwind/payments-api',
    },
    {
      id: 'worktree-web',
      session_id: 'session-checkout',
      worktree_path: '/worktrees/checkout/storefront-web',
      branch: 'ak/checkout-ui',
      parallel_index: 2,
      created_at: NOW - 20,
      mount_workspace_id: 'project-storefront-web',
      mount_name: 'storefront-web',
      repo_slug: 'northwind/storefront-web',
    },
    {
      id: 'worktree-unmounted',
      session_id: 'session-refunds',
      worktree_path: '/worktrees/refunds',
      branch: 'ak/refunds',
      parallel_index: 0,
      created_at: NOW - 10,
      mount_workspace_id: null,
      mount_name: null,
      repo_slug: null,
    },
  ];
  for (const row of worktrees) {
    await insertRow({ db, table: 'session_worktrees', row });
  }
  const tasks: ReadonlyArray<Row> = [
    {
      session_id: 'session-checkout',
      mount_workspace_id: 'project-payments-api',
      provider: 'github',
      external_id: '7',
      identifier: 'NW-7',
      url: 'https://example.test/7',
      title: 'Charge twice',
      created_at: NOW - 5,
      branch: 'ak/checkout',
    },
    {
      session_id: 'session-checkout',
      mount_workspace_id: 'project-storefront-web',
      provider: 'github',
      external_id: '7',
      identifier: 'NW-7',
      url: 'https://example.test/7',
      title: 'Charge twice',
      created_at: NOW - 4,
      branch: null,
    },
    {
      session_id: 'session-refunds',
      mount_workspace_id: null,
      provider: 'jira',
      external_id: 'NW-9',
      identifier: 'NW-9',
      url: 'https://example.test/9',
      title: 'Refund window',
      created_at: NOW - 3,
      branch: null,
    },
  ];
  for (const row of tasks) {
    await insertRow({ db, table: 'session_external_tasks', row });
  }
  return db;
};

const renameMount = (row: Row): Row => {
  const { mount_workspace_id: mount, ...rest } = row;
  return { ...rest, project_id: mount };
};

describe('m121 project session mounts', () => {
  it('keeps every worktree column and renames the mount to project_id', async () => {
    const db = await seedThrough120();
    const before = await selectRows({ db, table: 'session_worktrees', orderBy: 'id' });

    await migrateThrough({ db, version: 121 });
    const after = await selectRows({ db, table: 'session_worktrees', orderBy: 'id' });

    expect(before).toHaveLength(3);
    expect(after).toEqual(before.map(renameMount));
    expect(after.map((row) => row['project_id'])).toEqual([
      'project-payments-api',
      null,
      'project-storefront-web',
    ]);
  });

  it('keeps every external task, including the null mount and the branch', async () => {
    const db = await seedThrough120();
    const before = await selectRows({
      db,
      table: 'session_external_tasks',
      orderBy: 'session_id, mount_workspace_id',
    });

    await migrateThrough({ db, version: 121 });
    const after = await selectRows({
      db,
      table: 'session_external_tasks',
      orderBy: 'session_id, project_id',
    });

    expect(before).toHaveLength(3);
    expect(after).toEqual(before.map(renameMount));
  });

  it('keeps the per-mount identity unique and the worktree path unique', async () => {
    const db = await seedThrough120();
    await migrateThrough({ db, version: 121 });

    await expect(
      insertRow({
        db,
        table: 'session_external_tasks',
        row: {
          session_id: 'session-refunds',
          project_id: null,
          provider: 'jira',
          external_id: 'NW-9',
          identifier: 'NW-9',
          url: 'https://example.test/9',
          title: 'Again',
          created_at: NOW,
        },
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(
      insertRow({
        db,
        table: 'session_worktrees',
        row: {
          id: 'worktree-copy',
          session_id: 'session-refunds',
          worktree_path: '/worktrees/refunds',
          branch: 'ak/copy',
          created_at: NOW,
        },
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('enforces the project foreign key and cascades on delete', async () => {
    const db = await seedThrough120();
    await migrateThrough({ db, version: 121 });

    expect(await foreignKeyViolations(db)).toEqual([]);
    await db.execute("DELETE FROM projects WHERE id = 'project-storefront-web'");
    const worktrees = await db.select<{ readonly id: string }>(
      'SELECT id FROM session_worktrees ORDER BY id',
    );
    await db.execute("DELETE FROM sessions WHERE id = 'session-checkout'");
    const tasks = await db.select<{ readonly session_id: string }>(
      'SELECT session_id FROM session_external_tasks',
    );

    expect(worktrees).toEqual([{ id: 'worktree-api' }, { id: 'worktree-unmounted' }]);
    expect(tasks).toEqual([{ session_id: 'session-refunds' }]);
  });
});
