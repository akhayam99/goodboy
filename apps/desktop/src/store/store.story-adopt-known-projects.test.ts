import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, Session, SessionId, Workspace, WorkspaceId } from '@goodboy/types';
import {
  buildStoryProject,
  buildStorySession,
  buildStoryWorkspace,
  resetStorySpies,
  storySpies,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const STOREFRONT_WEB_WS = 'ws-storefront-web' as WorkspaceId;
const API_WS = 'ws-api' as WorkspaceId;
const STOREFRONT_WEB_PROJECT = 'project-storefront-web' as ProjectId;
const API_PROJECT = 'project-api' as ProjectId;

const storefrontWebShell = buildStoryWorkspace({
  id: STOREFRONT_WEB_WS,
  name: 'storefront-web',
  slug: 'storefront-web',
});
const apiShell = buildStoryWorkspace({ id: API_WS, name: 'api', slug: 'api' });
const storefrontWebProject = buildStoryProject({
  id: STOREFRONT_WEB_PROJECT,
  workspaceId: STOREFRONT_WEB_WS,
  name: 'storefront-web',
  rootPath: '/repos/storefront-web',
});
const apiProject = buildStoryProject({
  id: API_PROJECT,
  workspaceId: API_WS,
  name: 'api',
  rootPath: '/repos/api',
});

type FakeSessionRow = {
  readonly session: Session;
  workspaceId: WorkspaceId;
  readonly archived: boolean;
};

const fakeSessions: FakeSessionRow[] = [];

const seedFakeSession = ({
  id,
  workspaceId,
  archived = false,
}: {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly archived?: boolean;
}) => {
  fakeSessions.push({
    session: buildStorySession({
      id: id as SessionId,
      workspaceId,
      state: { kind: 'idle', lastActivityAt: '2026-08-22T00:00:00.000Z' as never },
    }),
    workspaceId,
    archived,
  });
};

const fakeWorkspaces = new Map<WorkspaceId, Workspace>();
const fakeProjectWorkspace = new Map<ProjectId, WorkspaceId>();

type StoreModule = typeof import('./store');
type DbModule = typeof import('@goodboy/db');
type RepoModule = typeof import('../shared/lib/repo');
let useAppStore: StoreModule['useAppStore'];
let dbMock: DbModule;
let repoMock: RepoModule;

beforeAll(async () => {
  ({ useAppStore } = await import('./store'));
  dbMock = await import('@goodboy/db');
  repoMock = await import('../shared/lib/repo');
  const skillsMock = await import('../features/skills/skills');
  vi.mocked(skillsMock.invokeSkillRescan).mockResolvedValue([] as never);
}, 60_000);

beforeEach(() => {
  resetStorySpies();
  fakeSessions.length = 0;
  fakeWorkspaces.clear();
  fakeProjectWorkspace.clear();
  fakeWorkspaces.set(storefrontWebShell.id, storefrontWebShell);
  fakeWorkspaces.set(apiShell.id, apiShell);
  fakeProjectWorkspace.set(STOREFRONT_WEB_PROJECT, STOREFRONT_WEB_WS);
  fakeProjectWorkspace.set(API_PROJECT, API_WS);
  for (let index = 0; index < 4; index += 1) {
    seedFakeSession({ id: `sess-web-${index}`, workspaceId: STOREFRONT_WEB_WS });
  }
  for (let index = 0; index < 4; index += 1) {
    seedFakeSession({ id: `sess-api-${index}`, workspaceId: API_WS });
  }
  seedFakeSession({ id: 'sess-api-archived', workspaceId: API_WS, archived: true });

  vi.mocked(repoMock.validateGitRepo).mockImplementation(async (path: string) => ({
    isRepo: true,
    rootPath: path,
    resolvedPath: path,
    error: null,
  }));
  vi.mocked(dbMock.findProjectByRootPath).mockImplementation(async ({ rootPath }) => {
    if (rootPath === '/repos/storefront-web') {
      return {
        ...storefrontWebProject,
        workspaceId: fakeProjectWorkspace.get(STOREFRONT_WEB_PROJECT)!,
      };
    }
    if (rootPath === '/repos/api') {
      return { ...apiProject, workspaceId: fakeProjectWorkspace.get(API_PROJECT)! };
    }
    return null;
  });
  vi.mocked(dbMock.describeProjectAdoption).mockImplementation(async ({ projectId }) => {
    const sourceWorkspaceId = fakeProjectWorkspace.get(projectId);
    if (sourceWorkspaceId === undefined) {
      return null;
    }
    return {
      sourceWorkspaceId,
      isShell: true,
      sessionCount: fakeSessions.filter((row) => row.workspaceId === sourceWorkspaceId).length,
    };
  });
  vi.mocked(dbMock.mergeWorkspaces).mockImplementation(
    async ({ sourceWorkspaceIds, targetWorkspaceId }) => {
      for (const sourceId of sourceWorkspaceIds) {
        for (const row of fakeSessions) {
          if (row.workspaceId === sourceId) {
            row.workspaceId = targetWorkspaceId;
          }
        }
        for (const [projectId, workspaceId] of fakeProjectWorkspace) {
          if (workspaceId === sourceId) {
            fakeProjectWorkspace.set(projectId, targetWorkspaceId);
          }
        }
        fakeWorkspaces.delete(sourceId);
      }
    },
  );
  vi.mocked(dbMock.listSessionsForWorkspace).mockImplementation(async (_db, workspaceId) =>
    fakeSessions
      .filter((row) => row.workspaceId === workspaceId && !row.archived)
      .map((row) => ({ ...row.session, workspaceId: row.workspaceId })),
  );
  vi.mocked(dbMock.listArchivedSessionsForWorkspace).mockImplementation(async (_db, workspaceId) =>
    fakeSessions
      .filter((row) => row.workspaceId === workspaceId && row.archived)
      .map((row) => ({ ...row.session, workspaceId: row.workspaceId })),
  );
  storySpies.listProjectsForWorkspace.mockImplementation((async ({
    workspaceId,
  }: {
    readonly workspaceId: WorkspaceId;
  }) =>
    [storefrontWebProject, apiProject]
      .filter((project) => fakeProjectWorkspace.get(project.id) === workspaceId)
      .map((project) => ({ ...project, workspaceId }))) as never);

  useAppStore.setState({
    workspaces: [storefrontWebShell, apiShell],
    projects: [storefrontWebProject, apiProject],
    currentWorkspaceId: null,
    sessions: [],
    archivedSessions: {},
  } as never);
});

describe('story: two migrated shells fuse into one workspace board', () => {
  it('adopts both known projects on attach and shows all nine sessions on one board', async () => {
    const acme = await useAppStore.getState().createWorkspace({ name: 'Acme' });
    await useAppStore.getState().setCurrentWorkspace(acme.id);
    expect(useAppStore.getState().sessions).toHaveLength(0);

    const first = await useAppStore
      .getState()
      .addProject({ workspaceId: acme.id, rootPath: '/repos/storefront-web' });
    expect(first.kind).toBe('conflict');
    if (first.kind !== 'conflict') {
      throw new Error('expected conflict result');
    }
    expect(first.conflict.sourceWorkspace.id).toBe(STOREFRONT_WEB_WS);
    expect(first.conflict.sessionCount).toBe(4);
    expect(first.conflict.isShell).toBe(true);

    const firstAdoption = await useAppStore
      .getState()
      .adoptProject({ projectId: STOREFRONT_WEB_PROJECT, targetWorkspaceId: acme.id });
    expect(firstAdoption.mergedWorkspace).toBe(true);
    expect(useAppStore.getState().sessions).toHaveLength(4);

    const second = await useAppStore
      .getState()
      .addProject({ workspaceId: acme.id, rootPath: '/repos/api' });
    expect(second.kind).toBe('conflict');
    if (second.kind !== 'conflict') {
      throw new Error('expected conflict result');
    }
    expect(second.conflict.sessionCount).toBe(5);

    await useAppStore
      .getState()
      .adoptProject({ projectId: API_PROJECT, targetWorkspaceId: acme.id });

    const state = useAppStore.getState();
    expect(state.sessions).toHaveLength(8);
    expect(state.sessions.every((session) => session.workspaceId === acme.id)).toBe(true);
    expect(state.workspaces.map((workspace) => workspace.id)).toEqual([acme.id]);
    expect(state.projects.map((project) => project.workspaceId)).toEqual([acme.id, acme.id]);

    await state.loadArchivedSessions(acme.id);
    const archived = useAppStore.getState().archivedSessions[acme.id] ?? [];
    expect(archived).toHaveLength(1);
    expect(useAppStore.getState().sessions.length + archived.length).toBe(9);
    expect(useAppStore.getState().archivedSessions[STOREFRONT_WEB_WS] ?? []).toHaveLength(0);
  });
});
