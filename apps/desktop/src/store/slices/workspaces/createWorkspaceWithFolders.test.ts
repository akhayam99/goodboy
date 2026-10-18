import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace } from '@goodboy/db';
import { brandId, type ProjectId, type WorkspaceId } from '@goodboy/types';
import {
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import type { CreateWorkspaceWithFoldersParams } from './createWorkspaceWithFolders';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);

const ACME = brandId<WorkspaceId>({ value: 'workspace-acme' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const NOTIFY = brandId<ProjectId>({ value: 'project-notify-relay' });
const LEDGER = brandId<ProjectId>({ value: 'project-ledger-core' });

const northwind = buildStoryWorkspace({ id: NORTHWIND, name: 'Northwind', slug: 'northwind' });

let useAppStore: StoryStore;

type CountRow = { readonly count: number };

type CountParams = {
  readonly sql: string;
  readonly params?: ReadonlyArray<unknown>;
};

const countOf = async ({ sql, params = [] }: CountParams): Promise<number> =>
  (await rowsOf<CountRow>({ sql, params }))[0]?.count ?? 0;

type CommandFailureParams = {
  readonly kind: string;
  readonly message: string;
};

const commandFailure = ({ kind, message }: CommandFailureParams): Error =>
  Object.assign(new Error(message), { kind });

const acmeRows = () =>
  countOf({ sql: 'SELECT COUNT(*) AS count FROM workspaces WHERE id = ?', params: [ACME] });

const seedNorthwind = async () => {
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: northwind });
  for (const [id, name] of [
    [NOTIFY, 'notify-relay'],
    [LEDGER, 'ledger-core'],
  ] as const) {
    await insertProject({
      db,
      project: buildStoryProject({
        id,
        workspaceId: NORTHWIND,
        name,
        rootPath: `/Users/me/Code/northwind/${name}`,
      }),
    });
  }
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, active_project_id, created_at, updated_at) VALUES ('session-relay', ?, 'Retry the relay', 'idle', ?, 1, 1)",
    [NORTHWIND, NOTIFY],
  );
  useAppStore.setState({ workspaces: [northwind] });
  return db;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await seedNorthwind();
});

describe('createWorkspaceWithFolders', () => {
  it('writes the workspace and its folders once, with the default branch, then shows them', async () => {
    const created = await useAppStore.getState().createWorkspaceWithFolders({
      workspaceId: ACME,
      name: 'Acme web',
      folders: [
        { kind: 'repository', rootPath: '/Users/me/Code/acme-web', defaultBranch: 'trunk' },
        { kind: 'plain', rootPath: '/Users/me/Code/design-notes' },
      ],
      moves: [],
    });

    const rows = await rowsOf<{
      readonly name: string;
      readonly kind: string;
      readonly base_branch: string | null;
    }>({
      sql: 'SELECT name, kind, base_branch FROM projects WHERE workspace_id = ? ORDER BY name',
      params: [ACME],
    });
    expect(rows).toEqual([
      { name: 'acme-web', kind: 'repo', base_branch: 'trunk' },
      { name: 'design-notes', kind: 'folder', base_branch: null },
    ]);
    expect(created.workspace.name).toBe('Acme web');
    expect(useAppStore.getState().workspaces.map((workspace) => workspace.id)).toContain(ACME);
    expect(
      useAppStore.getState().projects.filter((project) => project.workspaceId === ACME),
    ).toHaveLength(2);
  });

  it('leaves no workspace when a folder insert fails, and Retry creates it once', async () => {
    const params: CreateWorkspaceWithFoldersParams = {
      workspaceId: ACME,
      name: 'Acme web',
      folders: [
        { kind: 'repository', rootPath: '/Users/me/Code/acme-web', defaultBranch: 'main' },
        { kind: 'repository', rootPath: '/Users/me/Code/acme-api', defaultBranch: 'main' },
      ],
      moves: [],
    };
    injectDbFault({ match: /INSERT INTO projects/, skip: 1, message: 'disk I/O error' });

    await expect(useAppStore.getState().createWorkspaceWithFolders(params)).rejects.toThrow();

    expect(await acmeRows()).toBe(0);
    expect(useAppStore.getState().workspaces.map((workspace) => workspace.id)).not.toContain(ACME);

    await useAppStore.getState().createWorkspaceWithFolders(params);

    expect(await acmeRows()).toBe(1);
    expect(
      await countOf({
        sql: 'SELECT COUNT(*) AS count FROM projects WHERE workspace_id = ?',
        params: [ACME],
      }),
    ).toBe(2);
  });

  it('runs git init before any database write, and a git failure writes nothing', async () => {
    const seen: number[] = [];
    stubStoryInvoke({
      repo_init: async ({ path }: { readonly path: string }) => {
        seen.push(await acmeRows());
        return { rootPath: path, remoteUrl: '', branch: 'main' };
      },
    });

    await useAppStore.getState().createWorkspaceWithFolders({
      workspaceId: ACME,
      name: 'Acme web',
      folders: [{ kind: 'git-init', rootPath: '/Users/me/Code/acme-web' }],
      moves: [],
    });

    expect(seen).toEqual([0]);
    expect(await acmeRows()).toBe(1);
  });

  it("shows git's own message and writes nothing when git init fails", async () => {
    stubStoryInvoke({
      repo_init: () => {
        throw commandFailure({ kind: 'git', message: 'git failed: fatal: cannot write to .git' });
      },
    });

    await expect(
      useAppStore.getState().createWorkspaceWithFolders({
        workspaceId: ACME,
        name: 'Acme web',
        folders: [{ kind: 'git-init', rootPath: '/Users/me/Code/acme-web' }],
        moves: [],
      }),
    ).rejects.toThrow('fatal: cannot write to .git');
    expect(await acmeRows()).toBe(0);
  });

  it('starts from scratch: creates the folder, records the first lap, and resumes on Retry', async () => {
    const rootPath = '/Users/me/Code/cascadia';
    let isCreated = false;
    stubStoryInvoke({
      project_folder_create: () => {
        if (isCreated) {
          throw commandFailure({ kind: 'already_exists', message: `${rootPath} already exists` });
        }
        isCreated = true;
        return { rootPath, remoteUrl: '', branch: 'main' };
      },
      validate_git_repo: {
        isRepo: true,
        rootPath,
        resolvedPath: rootPath,
        defaultBranch: 'main',
        error: null,
        errorKind: null,
      },
    });
    const params: CreateWorkspaceWithFoldersParams = {
      workspaceId: ACME,
      name: 'Cascadia',
      folders: [{ kind: 'scratch', parentPath: '/Users/me/Code', name: 'cascadia' }],
      moves: [],
    };
    injectDbFault({ match: /INSERT INTO workspaces/, message: 'database is locked' });

    await expect(useAppStore.getState().createWorkspaceWithFolders(params)).rejects.toThrow();
    const created = await useAppStore.getState().createWorkspaceWithFolders(params);

    const projectId = created.projects[0]?.id;
    expect(projectId).toBeDefined();
    expect(
      await countOf({
        sql: 'SELECT COUNT(*) AS count FROM settings WHERE key = ?',
        params: [`bootstrap.phase.${projectId ?? ''}`],
      }),
    ).toBe(1);
    expect(
      projectId === undefined ? null : useAppStore.getState().bootstrapPhase[projectId]?.stage,
    ).toBe('first-lap');
  });

  it('moves the folder and its sessions here after the workspace exists', async () => {
    const created = await useAppStore.getState().createWorkspaceWithFolders({
      workspaceId: ACME,
      name: 'Acme web',
      folders: [{ kind: 'repository', rootPath: '/Users/me/Code/acme-web', defaultBranch: 'main' }],
      moves: [{ projectId: NOTIFY, fromWorkspaceId: NORTHWIND }],
    });

    const moved = await rowsOf<{ readonly workspace_id: string }>({
      sql: "SELECT workspace_id FROM sessions WHERE id = 'session-relay'",
    });
    expect(moved).toEqual([{ workspace_id: ACME }]);
    expect(created.movedSessionCount).toBe(1);
    expect(
      useAppStore.getState().projects.find((project) => project.id === NOTIFY)?.workspaceId,
    ).toBe(ACME);
  });

  it('refuses to move a folder while its agents run, and creates nothing', async () => {
    await storySqlite().execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent-relay', 'session-relay', 0, 'Implementer', 'running')",
    );

    await expect(
      useAppStore.getState().createWorkspaceWithFolders({
        workspaceId: ACME,
        name: 'Acme web',
        folders: [
          { kind: 'repository', rootPath: '/Users/me/Code/acme-web', defaultBranch: 'main' },
        ],
        moves: [{ projectId: NOTIFY, fromWorkspaceId: NORTHWIND }],
      }),
    ).rejects.toThrow('notify-relay was not moved: 1 agent is running in Northwind');
    expect(await acmeRows()).toBe(0);
  });

  it('refuses a folder another workspace holds before touching the disk', async () => {
    const initCalls: string[] = [];
    stubStoryInvoke({
      repo_init: ({ path }: { readonly path: string }) => {
        initCalls.push(path);
        return { rootPath: path, remoteUrl: '', branch: 'main' };
      },
    });

    await expect(
      useAppStore.getState().createWorkspaceWithFolders({
        workspaceId: ACME,
        name: 'Acme web',
        folders: [
          { kind: 'git-init', rootPath: '/Users/me/Code/acme-web' },
          { kind: 'plain', rootPath: '/Users/me/Code/northwind/ledger-core' },
        ],
        moves: [],
      }),
    ).rejects.toThrow('ledger-core is already in Northwind');
    expect(initCalls).toEqual([]);
    expect(await acmeRows()).toBe(0);
  });
});
