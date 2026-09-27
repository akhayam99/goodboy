import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Project, ProjectId, Workspace, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  listAllProjectsForWorkspace: vi.fn(async () => [] as ReadonlyArray<Project>),
  reconnectWorkspaceAndProjects: vi.fn(async () => undefined),
  updateProjectIdentity: vi.fn(async () => undefined),
  getWorkspaceById: vi.fn(async () => null as Workspace | null),
  projectRelocate: vi.fn(async () => ({
    relocationId: 'reloc-1',
    repairedGitLinks: true,
    restoredSessionFolders: 2,
  })),
  repoIdentity: vi.fn(async () => ({
    rootCommits: ['sha-2'] as ReadonlyArray<string>,
    remoteUrl: null,
  })),
}));

vi.mock('@goodboy/db', () => ({
  listAllProjectsForWorkspace: h.listAllProjectsForWorkspace,
  reconnectWorkspaceAndProjects: h.reconnectWorkspaceAndProjects,
  updateProjectIdentity: h.updateProjectIdentity,
  getWorkspaceById: h.getWorkspaceById,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workspace/projectRelocation', () => ({
  projectRelocate: h.projectRelocate,
}));
vi.mock('../../../shared/lib/repo', () => ({ repoIdentity: h.repoIdentity }));

import { reconnectMovedProject } from './reconnectMovedProject';

const NOW = '2026-08-22T00:00:00.000Z' as IsoDateTime;
const CASCADIA = 'ws-cascadia' as WorkspaceId;
const PROJECT_ID = 'proj-cascadia' as ProjectId;

const overrides = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
} as const;

const disconnectedWorkspace = (): Workspace => ({
  id: CASCADIA,
  name: 'Cascadia',
  slug: 'cascadia',
  overrides,
  createdAt: NOW,
  updatedAt: NOW,
  disconnectedAt: NOW,
});

const project = (): Project => ({
  id: PROJECT_ID,
  workspaceId: CASCADIA,
  name: 'ledger-core',
  rootPath: '/old/repos/ledger-core',
  kind: 'repo',
  overrides,
  createdAt: NOW,
  updatedAt: NOW,
  disconnectedAt: NOW,
});

type Harness = {
  state: AppStore;
  set: SetFn;
  get: GetFn;
};

const harness = (initial: Record<string, unknown>): Harness => {
  let state = {
    workspaces: [],
    disconnectedWorkspaces: [disconnectedWorkspace()],
    projects: [],
    ...initial,
  } as unknown as AppStore;
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
  };
  return {
    get state() {
      return state;
    },
    set,
    get: () => state,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconnectMovedProject slice action', () => {
  it('reconnects the workspace and relocates the project to its new path', async () => {
    h.listAllProjectsForWorkspace.mockResolvedValueOnce([project()]);
    h.getWorkspaceById.mockResolvedValueOnce(disconnectedWorkspace());
    const store = harness({});

    const workspace = await reconnectMovedProject(
      store.set,
      store.get,
    )({
      workspaceId: CASCADIA,
      projectId: PROJECT_ID,
      fromRoot: '/old/repos/ledger-core',
      toRoot: '/new/repos/ledger-core',
    });

    expect(h.reconnectWorkspaceAndProjects).toHaveBeenCalledWith({
      db: {},
      id: CASCADIA,
      projectIds: [PROJECT_ID],
      at: expect.any(String),
    });
    expect(h.projectRelocate).toHaveBeenCalledWith({
      relocationId: expect.any(String),
      projectId: PROJECT_ID,
      fromRoot: '/old/repos/ledger-core',
      toRoot: '/new/repos/ledger-core',
    });
    expect(h.updateProjectIdentity).toHaveBeenCalledWith({
      db: {},
      projectId: PROJECT_ID,
      rootCommit: 'sha-2',
      remoteUrl: null,
      checkedAt: expect.any(String),
    });
    expect(workspace.disconnectedAt).toBeUndefined();
    expect(store.state.disconnectedWorkspaces).toEqual([]);
    expect(store.state.workspaces.map((entry) => entry.id)).toEqual([CASCADIA]);
    const [relocated] = store.state.projects;
    expect(relocated?.rootPath).toBe('/new/repos/ledger-core');
    expect(relocated?.rootCommit).toBe('sha-2');
    expect(relocated?.disconnectedAt).toBeUndefined();
  });

  it('throws when the workspace no longer exists', async () => {
    h.listAllProjectsForWorkspace.mockResolvedValueOnce([project()]);
    h.getWorkspaceById.mockResolvedValueOnce(null);
    const store = harness({});

    await expect(
      reconnectMovedProject(
        store.set,
        store.get,
      )({
        workspaceId: CASCADIA,
        projectId: PROJECT_ID,
        fromRoot: '/old/repos/ledger-core',
        toRoot: '/new/repos/ledger-core',
      }),
    ).rejects.toThrow('workspace no longer exists');
  });
});
