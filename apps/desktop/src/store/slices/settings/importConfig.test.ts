import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ConfigBundleImportResult,
  IsoDateTime,
  Project,
  ProjectId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  importConfigFromFile: vi.fn<() => Promise<ConfigBundleImportResult | null>>(),
  listWorkspaces: vi.fn<() => Promise<Workspace[]>>(async () => []),
  listProjectsForWorkspace: vi.fn<(params: { workspaceId: string }) => Promise<Project[]>>(
    async () => [],
  ),
}));

vi.mock('../../../features/settings/config-export', () => ({
  importConfigFromFile: h.importConfigFromFile,
}));
vi.mock('@goodboy/db', () => ({
  listWorkspaces: h.listWorkspaces,
  listProjectsForWorkspace: h.listProjectsForWorkspace,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { importConfig } from './importConfig';

const NOW = '2026-09-26T00:00:00.000Z' as IsoDateTime;

const workspace = (id: string): Workspace => ({
  id: id as WorkspaceId,
  name: id,
  slug: id,
  overrides: {
    defaultProviderId: null,
    defaultWorkflowId: null,
    defaultBranchPrefix: null,
    parallelEnabled: null,
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
  },
  createdAt: NOW,
  updatedAt: NOW,
});

const project = (id: string, workspaceId: string): Project => ({
  id: id as ProjectId,
  workspaceId: workspaceId as WorkspaceId,
  name: id,
  rootPath: `/repos/${id}`,
  kind: 'repo',
  overrides: {
    defaultProviderId: null,
    defaultWorkflowId: null,
    defaultBranchPrefix: null,
    parallelEnabled: null,
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
  },
  createdAt: NOW,
  updatedAt: NOW,
});

const harness = () => {
  let state = {
    workspaces: [] as ReadonlyArray<Workspace>,
    projects: [] as ReadonlyArray<Project>,
    loadPhaseTemplates: vi.fn(async () => undefined),
    rescanSkills: vi.fn(async () => undefined),
    loadBudgetRules: vi.fn(async () => undefined),
    loadSetting: vi.fn(async () => null),
  } as unknown as AppStore;
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
  };
  const get: GetFn = () => state;
  return {
    get state() {
      return state;
    },
    set,
    get,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('importConfig', () => {
  it('returns null when the user cancels the file picker', async () => {
    h.importConfigFromFile.mockResolvedValueOnce(null);
    const store = harness();

    const result = await importConfig(store.set, store.get)();

    expect(result).toBeNull();
    expect(h.listWorkspaces).not.toHaveBeenCalled();
  });

  it('leaves the store untouched when the import reports validation errors', async () => {
    const failure: ConfigBundleImportResult = {
      ok: false,
      errors: [{ field: 'workspaces[0].name', message: 'is required' }],
      stats: { workspaces: 0, skills: 0, phaseTemplates: 0, permissionRules: 0, budgetRules: 0 },
    };
    h.importConfigFromFile.mockResolvedValueOnce(failure);
    const store = harness();

    const result = await importConfig(store.set, store.get)();

    expect(result).toEqual(failure);
    expect(h.listWorkspaces).not.toHaveBeenCalled();
  });

  it('reloads workspaces, projects, workflows, skills, budget rules and settings after a successful import', async () => {
    const success: ConfigBundleImportResult = {
      ok: true,
      errors: [],
      stats: { workspaces: 2, skills: 0, phaseTemplates: 3, permissionRules: 4, budgetRules: 5 },
    };
    h.importConfigFromFile.mockResolvedValueOnce(success);
    const wsA = workspace('ws-a');
    const wsB = workspace('ws-b');
    h.listWorkspaces.mockResolvedValueOnce([wsA, wsB]);
    h.listProjectsForWorkspace.mockImplementation(
      async ({ workspaceId }: { workspaceId: string }) => [project('proj', workspaceId)],
    );
    const store = harness();

    const result = await importConfig(store.set, store.get)();

    expect(result).toEqual(success);
    expect(store.state.workspaces).toEqual([wsA, wsB]);
    expect(store.state.projects.map((p) => p.workspaceId)).toEqual(['ws-a', 'ws-b']);
    expect(store.state.loadPhaseTemplates).toHaveBeenCalledWith('ws-a');
    expect(store.state.loadPhaseTemplates).toHaveBeenCalledWith('ws-b');
    expect(store.state.rescanSkills).toHaveBeenCalledWith('ws-a');
    expect(store.state.rescanSkills).toHaveBeenCalledWith('ws-b');
    expect(store.state.loadBudgetRules).toHaveBeenCalledTimes(1);
    expect(store.state.loadSetting).toHaveBeenCalledWith('editor.binary');
  });

  it('never touches currentWorkspaceId or session state, so no turn gets cancelled', async () => {
    const success: ConfigBundleImportResult = {
      ok: true,
      errors: [],
      stats: { workspaces: 1, skills: 0, phaseTemplates: 0, permissionRules: 0, budgetRules: 0 },
    };
    h.importConfigFromFile.mockResolvedValueOnce(success);
    h.listWorkspaces.mockResolvedValueOnce([workspace('ws-a')]);
    const store = harness();
    store.set({
      currentWorkspaceId: 'ws-a' as WorkspaceId,
      currentSessionId: 'session-1' as never,
    });

    await importConfig(store.set, store.get)();

    expect(store.state.currentWorkspaceId).toBe('ws-a');
    expect(store.state.currentSessionId).toBe('session-1');
  });
});
