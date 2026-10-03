import { describe, expect, it } from 'vitest';
import type { IsoDateTime, WorkspaceExternalTask, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  deleteWorkspaceExternalTask,
  listWorkspaceExternalTasks,
  upsertWorkspaceExternalTask,
} from './workspace-external-task';

const harborline = 'harborline' as WorkspaceId;
const northwind = 'northwind' as WorkspaceId;

const seed = async () => {
  const db = await makeMigratedTestDatabase({});
  const now = Date.now();
  for (const id of [harborline, northwind]) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, id, id, now, now],
    );
  }
  return db;
};

const umbrella = (overrides: Partial<WorkspaceExternalTask> = {}): WorkspaceExternalTask => ({
  workspaceId: harborline,
  provider: 'linear',
  externalId: 'lin-400',
  identifier: 'HAR-400',
  url: 'https://linear.app/harborline/issue/HAR-400',
  title: 'Payments revamp',
  createdAt: new Date('2026-09-30T08:00:00Z').toISOString() as IsoDateTime,
  ...overrides,
});

describe('workspace_external_tasks queries', () => {
  it('keeps one row per task in a workspace and refreshes its title', async () => {
    const db = await seed();
    await upsertWorkspaceExternalTask({ db, task: umbrella() });
    await upsertWorkspaceExternalTask({
      db,
      task: umbrella({ title: 'Payments revamp, phase 2' }),
    });
    await upsertWorkspaceExternalTask({ db, task: umbrella({ workspaceId: northwind }) });

    expect(await listWorkspaceExternalTasks({ db, workspaceId: harborline })).toEqual([
      umbrella({ title: 'Payments revamp, phase 2' }),
    ]);
    expect(await listWorkspaceExternalTasks({ db, workspaceId: northwind })).toEqual([
      umbrella({ workspaceId: northwind }),
    ]);
  });

  it('removes a task from one workspace only', async () => {
    const db = await seed();
    await upsertWorkspaceExternalTask({ db, task: umbrella() });
    await upsertWorkspaceExternalTask({ db, task: umbrella({ workspaceId: northwind }) });

    await deleteWorkspaceExternalTask({
      db,
      workspaceId: harborline,
      provider: 'linear',
      externalId: 'lin-400',
    });

    expect(await listWorkspaceExternalTasks({ db, workspaceId: harborline })).toEqual([]);
    expect(await listWorkspaceExternalTasks({ db, workspaceId: northwind })).toHaveLength(1);
  });
});
