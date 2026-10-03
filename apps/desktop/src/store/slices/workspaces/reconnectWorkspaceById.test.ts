// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Project, ProjectId, Workspace, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  listAllProjectsForWorkspace: vi.fn(async () => [] as ReadonlyArray<Project>),
  reconnectWorkspaceAndProjects: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    listAllProjectsForWorkspace: h.listAllProjectsForWorkspace,
    reconnectWorkspaceAndProjects: h.reconnectWorkspaceAndProjects,
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { reconnectWorkspaceById } from './reconnectWorkspaceById';

const NOW = '2026-08-22T00:00:00.000Z' as IsoDateTime;
const CASCADIA = 'ws-cascadia' as WorkspaceId;

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
  defaultBranchTemplate: null,
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

const project = (id: string): Project => ({
  id: id as ProjectId,
  workspaceId: CASCADIA,
  name: id,
  rootPath: `/repos/${id}`,
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

describe('reconnectWorkspaceById slice action', () => {
  it('moves the workspace and its projects back into the live lists', async () => {
    h.listAllProjectsForWorkspace.mockResolvedValueOnce([project('ledger-core')]);
    const store = harness({});

    await reconnectWorkspaceById(store.set, store.get)(CASCADIA);

    expect(h.reconnectWorkspaceAndProjects).toHaveBeenCalledWith({
      db: {},
      id: CASCADIA,
      projectIds: ['ledger-core'],
      at: expect.any(String),
    });
    expect(store.state.disconnectedWorkspaces).toEqual([]);
    expect(store.state.workspaces.map((entry) => entry.id)).toEqual([CASCADIA]);
    expect(store.state.workspaces[0]?.disconnectedAt).toBeUndefined();
    expect(store.state.projects.map((entry) => entry.id)).toEqual(['ledger-core']);
    expect(store.state.projects[0]?.disconnectedAt).toBeUndefined();
  });

  it('does nothing for a workspace that is not in the disconnected list', async () => {
    const store = harness({ disconnectedWorkspaces: [] });

    await reconnectWorkspaceById(store.set, store.get)(CASCADIA);

    expect(h.reconnectWorkspaceAndProjects).not.toHaveBeenCalled();
    expect(store.state.workspaces).toEqual([]);
  });
});
