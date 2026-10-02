// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId } from '@goodboy/types';
import { aProject, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';

const h = vi.hoisted(() => ({
  setSetting: vi.fn(async () => undefined),
  deleteSetting: vi.fn(async () => undefined),
  listSettingsWithPrefix: vi.fn(
    async (): Promise<ReadonlyArray<{ readonly key: string; readonly value: string }>> => [],
  ),
  projectFolderCreate: vi.fn(async () => ({
    rootPath: '/games/cascadia',
    remoteUrl: '',
    branch: 'main',
  })),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    setSetting: h.setSetting,
    deleteSetting: h.deleteSetting,
    listSettingsWithPrefix: h.listSettingsWithPrefix,
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../shared/lib/repo', () => ({ projectFolderCreate: h.projectFolderCreate }));

import { createBootstrapSlice } from './index';
import { isProjectInFirstLap } from './firstLap';
import { bootstrapPhaseKey, parseBootstrapPhase, serializeBootstrapPhase } from './phase';

const PROJECT_ID = 'proj-cascadia' as ProjectId;
const workspace = aWorkspace({ name: 'cascadia' });
const project = aProject({
  id: PROJECT_ID,
  workspaceId: workspace.id,
  rootPath: '/games/cascadia',
});

const makeSlice = () => {
  const store: { state: AppStore } = {
    state: {
      ...useAppStore.getState(),
      bootstrapPhase: {},
      projects: [project],
      addWorkspace: vi.fn(async () => workspace),
      disconnectWorkspace: vi.fn(async () => undefined),
    },
  };
  const set: Parameters<typeof createBootstrapSlice>[0]['set'] = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get = () => store.state;
  const slice = createBootstrapSlice({ set, get });
  store.state = { ...store.state, ...slice };
  return { store, slice };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bootstrap phase storage', () => {
  it('round trips a phase through its settings row', () => {
    const { slice } = makeSlice();
    expect(slice.bootstrapPhase).toEqual({});

    const phase = {
      stage: 'moving' as const,
      firstLapSessionId: null,
      bootstrapSessionId: null,
      snapshotId: 'snap-1',
      worktreePath: null,
      branch: null,
      updatedAt: TEST_NOW,
    };
    expect(parseBootstrapPhase(serializeBootstrapPhase(phase))).toEqual(phase);
  });

  it('ignores a corrupt row', () => {
    expect(parseBootstrapPhase('not json')).toBeNull();
    expect(parseBootstrapPhase('{"stage":"sideways","updatedAt":"x"}')).toBeNull();
    expect(parseBootstrapPhase('[]')).toBeNull();
  });
});

describe('setBootstrapPhase', () => {
  it('starts at first lap, stores the row and only moves forward', async () => {
    const { store, slice } = makeSlice();

    const first = await slice.setBootstrapPhase({ projectId: PROJECT_ID, patch: {} });
    expect(first.stage).toBe('first-lap');
    expect(h.setSetting).toHaveBeenCalledWith(
      {},
      bootstrapPhaseKey(PROJECT_ID),
      expect.stringContaining('"stage":"first-lap"'),
    );
    expect(isProjectInFirstLap({ state: store.state, projectId: PROJECT_ID })).toBe(true);

    await slice.setBootstrapPhase({ projectId: PROJECT_ID, patch: { stage: 'moving' } });
    await slice.setBootstrapPhase({ projectId: PROJECT_ID, patch: { stage: 'done' } });
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('done');
    expect(isProjectInFirstLap({ state: store.state, projectId: PROJECT_ID })).toBe(false);

    await expect(
      slice.setBootstrapPhase({ projectId: PROJECT_ID, patch: { stage: 'first-lap' } }),
    ).rejects.toThrow('cannot go back');
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('done');
  });

  it('returns a stable reference for an unchanged project', async () => {
    const { store, slice } = makeSlice();
    await slice.setBootstrapPhase({ projectId: PROJECT_ID, patch: {} });

    const before = store.state.bootstrapPhase[PROJECT_ID];
    const after = store.state.bootstrapPhase[PROJECT_ID];

    expect(after).toBe(before);
    expect(store.state.bootstrapPhase['proj-other' as ProjectId]).toBeUndefined();
  });
});

describe('hydrateBootstrapPhases', () => {
  it('loads every readable row by project and skips the rest', async () => {
    const { store, slice } = makeSlice();
    const phase = serializeBootstrapPhase({
      stage: 'done',
      firstLapSessionId: null,
      bootstrapSessionId: null,
      snapshotId: null,
      worktreePath: null,
      branch: null,
      updatedAt: TEST_NOW,
    });
    h.listSettingsWithPrefix.mockResolvedValueOnce([
      { key: bootstrapPhaseKey(PROJECT_ID), value: phase },
      { key: bootstrapPhaseKey('proj-broken' as ProjectId), value: 'garbage' },
    ]);

    await slice.hydrateBootstrapPhases();

    expect(Object.keys(store.state.bootstrapPhase)).toEqual([PROJECT_ID]);
    expect(store.state.bootstrapPhase[PROJECT_ID]?.stage).toBe('done');
  });
});

describe('createNewProject', () => {
  it('creates the folder and repository, registers the workspace and starts the first lap', async () => {
    const { store, slice } = makeSlice();

    const created = await slice.createNewProject({ parentPath: '/games', name: ' cascadia ' });

    expect(h.projectFolderCreate).toHaveBeenCalledWith({ parentPath: '/games', name: 'cascadia' });
    expect(store.state.addWorkspace).toHaveBeenCalledWith({
      rootPath: '/games/cascadia',
      name: 'cascadia',
    });
    expect(created.project.id).toBe(PROJECT_ID);
    expect(isProjectInFirstLap({ state: store.state, projectId: PROJECT_ID })).toBe(true);
  });

  it('stops before registering anything when the folder cannot be created', async () => {
    const { store, slice } = makeSlice();
    h.projectFolderCreate.mockRejectedValueOnce(new Error('cascadia already exists'));

    await expect(
      slice.createNewProject({ parentPath: '/games', name: 'cascadia' }),
    ).rejects.toThrow('already exists');
    expect(store.state.addWorkspace).not.toHaveBeenCalled();
    expect(h.setSetting).not.toHaveBeenCalled();
  });

  it('tries the phase row a second time before giving up', async () => {
    const { store, slice } = makeSlice();
    h.setSetting.mockRejectedValueOnce(new Error('database is locked'));

    await slice.createNewProject({ parentPath: '/games', name: 'cascadia' });

    expect(isProjectInFirstLap({ state: store.state, projectId: PROJECT_ID })).toBe(true);
    expect(store.state.disconnectWorkspace).not.toHaveBeenCalled();
  });

  it('disconnects the half-made workspace and removes the phase row when it cannot be stored', async () => {
    const { store, slice } = makeSlice();
    h.setSetting.mockRejectedValue(new Error('disk full'));

    await expect(
      slice.createNewProject({ parentPath: '/games', name: 'cascadia' }),
    ).rejects.toThrow('disk full');
    expect(store.state.disconnectWorkspace).toHaveBeenCalledWith(workspace.id);
    expect(h.deleteSetting).toHaveBeenCalledWith({}, bootstrapPhaseKey(PROJECT_ID));
    expect(store.state.bootstrapPhase).toEqual({});
  });
});
