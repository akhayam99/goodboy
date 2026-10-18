import { describe, expect, it } from 'vitest';
import { brandId, type ProjectId, type WorkspaceId } from '@goodboy/types';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertWorkspaceWithProjects } from './workspace-create';
import { insertProject } from './project';
import { insertWorkspace } from './workspace';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-acme' });
const OTHER_ID = brandId<WorkspaceId>({ value: 'workspace-northwind' });

type CountRow = { readonly count: number };

describe('insertWorkspaceWithProjects', () => {
  it('writes the workspace and every folder together', async () => {
    const db = await makeMigratedTestDatabase();
    const workspace = aWorkspace({ id: WORKSPACE_ID, name: 'Acme web', slug: 'acme-web' });

    await insertWorkspaceWithProjects({
      db,
      workspace,
      projects: [
        aProject({ workspaceId: WORKSPACE_ID, rootPath: '/code/acme-web', baseBranch: 'main' }),
        aProject({ workspaceId: WORKSPACE_ID, rootPath: '/code/ledger-core', baseBranch: null }),
      ],
      settings: [{ key: 'bootstrap.phase.ledger', value: '{}' }],
    });

    const rows = await db.select<{ readonly root_path: string; readonly base_branch: string }>(
      'SELECT root_path, base_branch FROM projects WHERE workspace_id = ? ORDER BY root_path',
      [WORKSPACE_ID],
    );
    expect(rows).toEqual([
      { root_path: '/code/acme-web', base_branch: 'main' },
      { root_path: '/code/ledger-core', base_branch: null },
    ]);
    const settings = await db.select<{ readonly value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['bootstrap.phase.ledger'],
    );
    expect(settings).toEqual([{ value: '{}' }]);
  });

  it('leaves no workspace and no folder when a later insert fails', async () => {
    const db = await makeMigratedTestDatabase();
    await insertWorkspace({ db, workspace: aWorkspace({ id: OTHER_ID, slug: 'northwind' }) });
    await insertProject({
      db,
      project: aProject({ workspaceId: OTHER_ID, rootPath: '/code/notify-relay' }),
    });

    await expect(
      insertWorkspaceWithProjects({
        db,
        workspace: aWorkspace({ id: WORKSPACE_ID, slug: 'acme-web' }),
        projects: [
          aProject({ workspaceId: WORKSPACE_ID, rootPath: '/code/acme-web' }),
          aProject({ workspaceId: WORKSPACE_ID, rootPath: '/code/notify-relay' }),
        ],
        settings: [{ key: 'bootstrap.phase.acme', value: '{}' }],
      }),
    ).rejects.toThrow();

    const workspaces = await db.select<CountRow>(
      'SELECT COUNT(*) AS count FROM workspaces WHERE id = ?',
      [WORKSPACE_ID],
    );
    const projects = await db.select<CountRow>(
      'SELECT COUNT(*) AS count FROM projects WHERE root_path = ?',
      ['/code/acme-web'],
    );
    const settings = await db.select<CountRow>(
      'SELECT COUNT(*) AS count FROM settings WHERE key = ?',
      ['bootstrap.phase.acme'],
    );
    expect(workspaces[0]?.count).toBe(0);
    expect(projects[0]?.count).toBe(0);
    expect(settings[0]?.count).toBe(0);
  });

  it('adds folders to a workspace that already exists', async () => {
    const db = await makeMigratedTestDatabase();
    await insertWorkspace({ db, workspace: aWorkspace({ id: WORKSPACE_ID, slug: 'acme-web' }) });
    const folder = aProject({
      id: brandId<ProjectId>({ value: 'project-ledger' }),
      workspaceId: WORKSPACE_ID,
      rootPath: '/code/ledger-core',
    });

    await insertWorkspaceWithProjects({ db, workspace: null, projects: [folder], settings: [] });

    const rows = await db.select<{ readonly id: string }>(
      'SELECT id FROM projects WHERE workspace_id = ?',
      [WORKSPACE_ID],
    );
    expect(rows).toEqual([{ id: 'project-ledger' }]);
  });
});
