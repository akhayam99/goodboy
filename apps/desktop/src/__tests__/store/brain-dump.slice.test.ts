import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IdeaBacklog, IdeaBacklogId, IsoDateTime, WorkspaceId } from '@goodboy/types';

const insertIdeaMock = vi.fn();
const updateIdeaRephraseMock = vi.fn();
const updateIdeaFailedMock = vi.fn();
const markIdeaSpawnedMock = vi.fn();
const deleteIdeaMock = vi.fn();
const listIdeasForWorkspaceMock = vi.fn();
const listRawIdeasMock = vi.fn();

const rephraseMock = vi.fn();
const clusterizeMock = vi.fn();
const createSessionMock = vi.fn(async () => ({ session: {}, worktree: {} }));

vi.mock('@goodboy/db', () => ({
  insertIdea: (...args: unknown[]) => insertIdeaMock(...args),
  updateIdeaRephrase: (...args: unknown[]) => updateIdeaRephraseMock(...args),
  updateIdeaFailed: (...args: unknown[]) => updateIdeaFailedMock(...args),
  markIdeaSpawned: (...args: unknown[]) => markIdeaSpawnedMock(...args),
  deleteIdea: (...args: unknown[]) => deleteIdeaMock(...args),
  listIdeasForWorkspace: (...args: unknown[]) => listIdeasForWorkspaceMock(...args),
  listRawIdeas: (...args: unknown[]) => listRawIdeasMock(...args),
}));

vi.mock('@goodboy/core', async () => {
  return {
    Rephraser: class {
      rephrase = rephraseMock;
    },
    Clusterizer: class {
      clusterize = clusterizeMock;
    },
  };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../shared/lib/db', () => ({ tauriDatabase: { execute: vi.fn(), select: vi.fn() } }));

const W1 = 'w1' as WorkspaceId;
const AT = '2026-05-21T00:00:00.000Z' as IsoDateTime;

function makeIdea(id: string, partial: Partial<IdeaBacklog> = {}): IdeaBacklog {
  return {
    id: id as IdeaBacklogId,
    rawText: 'raw',
    rephrasedTitle: null,
    rephrasedBody: null,
    suggestedWorkspaceId: null,
    workspaceId: W1,
    status: 'raw',
    retryCount: 0,
    lastError: null,
    createdAt: AT,
    updatedAt: AT,
    ...partial,
  };
}

import { createBrainDumpSlice, initialBrainDumpState } from '../../store/slices/brain-dump.slice';

type AppStore = {
  ideas: Record<WorkspaceId, ReadonlyArray<IdeaBacklog>>;
  ideasLoading: Record<WorkspaceId, boolean>;
  rephrasingIdeaIds: ReadonlySet<IdeaBacklogId>;
  clusterPreview: { clusters: ReadonlyArray<unknown> } | null;
  clusterizing: boolean;
  clusterError: string | null;
  workspaces: ReadonlyArray<{ id: WorkspaceId; name: string }>;
  providers: ReadonlyArray<{ id: string; connection: string }>;
  currentSessionId: string | null;
  sessions: ReadonlyArray<unknown>;
  createSession: typeof createSessionMock;
};

function makeStore(): { state: AppStore; slice: ReturnType<typeof createBrainDumpSlice> } {
  const state: AppStore = {
    ...initialBrainDumpState,
    ideas: { ...initialBrainDumpState.ideas },
    ideasLoading: { ...initialBrainDumpState.ideasLoading },
    workspaces: [{ id: W1, name: 'home' }],
    providers: [{ id: 'anthropic', connection: 'connected' }],
    currentSessionId: null,
    sessions: [],
    createSession: createSessionMock,
  };
  const set = (patch: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    Object.assign(state, next);
  };
  const get = () => state as never;
  // brain-dump slice expects AppStore shape; ours is a subset but functionally enough.
  const slice = createBrainDumpSlice(set as never, get as never);
  return { state, slice };
}

beforeEach(() => {
  insertIdeaMock.mockReset();
  updateIdeaRephraseMock.mockReset();
  updateIdeaFailedMock.mockReset();
  markIdeaSpawnedMock.mockReset();
  deleteIdeaMock.mockReset();
  listIdeasForWorkspaceMock.mockReset();
  listRawIdeasMock.mockReset();
  rephraseMock.mockReset();
  clusterizeMock.mockReset();
  createSessionMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('brain-dump slice', () => {
  it('submitBrainDump inserts, marks rephrasing, then transitions to rephrased', async () => {
    const { state, slice } = makeStore();
    const inserted = makeIdea('i1');
    insertIdeaMock.mockResolvedValue(inserted);
    rephraseMock.mockResolvedValue({
      title: 'crisp',
      body: 'clear',
      suggestedWorkspaceId: null,
    });
    updateIdeaRephraseMock.mockImplementation(async (_db, _id, title, body, suggested) =>
      makeIdea('i1', {
        rephrasedTitle: title,
        rephrasedBody: body,
        suggestedWorkspaceId: suggested,
        status: 'rephrased',
      }),
    );

    await slice.submitBrainDump(W1, 'raw thought');

    // microtask flush so the fire-and-forget rephrase resolves
    await Promise.resolve();
    await Promise.resolve();

    expect(insertIdeaMock).toHaveBeenCalledOnce();
    expect(rephraseMock).toHaveBeenCalledOnce();
    expect(state.ideas[W1]).toBeDefined();
    expect(state.ideas[W1]!.length).toBe(1);
    expect(state.ideas[W1]![0]!.status).toBe('rephrased');
    expect(state.rephrasingIdeaIds.size).toBe(0);
  });

  it('submitBrainDump on rephraser error increments retry count and stays raw', async () => {
    const { state, slice } = makeStore();
    insertIdeaMock.mockResolvedValue(makeIdea('i1'));
    rephraseMock.mockRejectedValue(new Error('boom'));
    updateIdeaFailedMock.mockImplementation(async (_db, _id, retryCount, lastError) =>
      makeIdea('i1', { retryCount, lastError, status: retryCount >= 2 ? 'failed' : 'raw' }),
    );

    await slice.submitBrainDump(W1, 'raw');
    await Promise.resolve();
    await Promise.resolve();

    expect(updateIdeaFailedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      1,
      'boom',
    );
    expect(state.ideas[W1]![0]!.status).toBe('raw');
    expect(state.ideas[W1]![0]!.retryCount).toBe(1);
  });

  it('submitBrainDump rejects empty input', async () => {
    const { slice } = makeStore();
    await expect(slice.submitBrainDump(W1, '   ')).rejects.toThrow(/empty/i);
    expect(insertIdeaMock).not.toHaveBeenCalled();
  });

  it('runClusterer needs at least 2 rephrased ideas', async () => {
    const { state, slice } = makeStore();
    state.ideas = {
      [W1]: [makeIdea('i1', { status: 'rephrased', rephrasedTitle: 't', rephrasedBody: 'b' })],
    };
    await slice.runClusterer(W1);
    expect(clusterizeMock).not.toHaveBeenCalled();
    expect(state.clusterError).toMatch(/at least 2/i);
  });

  it('runClusterer stores the preview on success', async () => {
    const { state, slice } = makeStore();
    state.ideas = {
      [W1]: [
        makeIdea('a', { status: 'rephrased', rephrasedTitle: 'A' }),
        makeIdea('b', { status: 'rephrased', rephrasedTitle: 'B' }),
      ],
    };
    clusterizeMock.mockResolvedValue({
      clusters: [{ id: 'c1', name: 'group', itemIds: ['a', 'b'] }],
    });
    await slice.runClusterer(W1);
    expect(state.clusterPreview?.clusters.length).toBe(1);
    expect(state.clusterizing).toBe(false);
  });

  it('spawnFromCluster creates a planner session and marks members spawned', async () => {
    const { state, slice } = makeStore();
    state.ideas = {
      [W1]: [
        makeIdea('a', { status: 'rephrased', rephrasedTitle: 'A' }),
        makeIdea('b', { status: 'rephrased', rephrasedTitle: 'B' }),
      ],
    };
    markIdeaSpawnedMock.mockResolvedValue(undefined);
    await slice.spawnFromCluster(
      { id: 'cl1', name: 'auth', itemIds: ['a', 'b'] as never },
      { workspaceId: W1 },
    );
    expect(createSessionMock).toHaveBeenCalledOnce();
    const arg = createSessionMock.mock.calls[0]![0]!;
    expect(arg.firstAgentKind).toBe('planner');
    expect(arg.goal).toContain('Cluster: auth');
    expect(markIdeaSpawnedMock).toHaveBeenCalledTimes(2);
    expect(state.ideas[W1]?.length).toBe(0);
  });
});
