import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type { AutoTreeView } from './slices/auto-view/state';
import {
  brandId,
  type Agent,
  type AgentId,
  type ProjectId,
  type SessionId,
  type TurnEvent,
  type WorkspaceId,
} from '@goodboy/types';

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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const runTurnSpy = storySpies.runTurn;
const phaseRunInsertSpy = storySpies.invokeAgentInsert;
const phaseRunListSpy = storySpies.invokeAgentList;

async function* emptyStream(): AsyncIterable<TurnEvent> {}

const WS_ID = brandId<WorkspaceId>({ value: 'ws-1' });
const GOAL = 'Settlement totals are off by a few cents per batch';

let inserted: Agent[] = [];

const wireDefaults = () => {
  storySpies.getWorkspaceById.mockImplementation(async ({ id }) =>
    buildStoryWorkspace({ id, name: 'Harborline', slug: 'harborline' }),
  );
  storySpies.listProjectsForWorkspace.mockImplementation(async ({ workspaceId }) => [
    buildStoryProject({
      id: brandId<ProjectId>({ value: 'project-1' }),
      workspaceId,
      name: 'ledger-core',
      rootPath: '/tmp',
    }),
  ]);
  storySpies.listWorkspaces.mockImplementation(async () => [
    buildStoryWorkspace({ id: WS_ID, name: 'Harborline' }),
  ]);
  storySpies.createWorktree.mockImplementation(async () => ({
    worktreePath: '/tmp/wt',
    branchName: 'nw/settle',
    slug: 'settle',
  }));
  storySpies.scratchDirPrepare.mockImplementation(
    async () => '/tmp/goodboy-root/scratch/mountless',
  );
  inserted = [];
  phaseRunInsertSpy.mockImplementation(async (args: Record<string, unknown>) => {
    const sessionId = args['sessionId'];
    const ordinal = args['ordinal'];
    const name = args['name'];
    const row: Agent = {
      id: brandId<AgentId>({ value: `agent-${inserted.length + 1}` }),
      sessionId: brandId<SessionId>({ value: typeof sessionId === 'string' ? sessionId : '' }),
      ordinal: typeof ordinal === 'number' ? ordinal : 0,
      name: typeof name === 'string' ? name : '',
      status: 'pending',
    };
    inserted.push(row);
    return row;
  });
  phaseRunListSpy.mockImplementation(async () => inserted);
};

const routeTo = async () => {
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-haiku-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  return routingMod.resolveProviderForTurn;
};

const lastRunArgs = () => runTurnSpy.mock.calls.at(-1)?.[0];

const viewWithChild = (params: {
  rootAgentId: AgentId;
  childAgentId: AgentId;
  role: string;
}): AutoTreeView =>
  ({
    tree: { rootAgentId: params.rootAgentId },
    delegations: [{ childAgentId: params.childAgentId, role: params.role, isAdopted: false }],
  }) as unknown as AutoTreeView;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

describe('what a turn on an Auto child is confined to', () => {
  beforeEach(() => {
    resetStorySpies();
    wireDefaults();
    useAppStore.setState({ agentRunHistory: {}, transcripts: {}, agentHandoffs: {} });
    runTurnSpy.mockImplementation(() => emptyStream());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const childSession = async (params: { kind: 'scout' | 'implementer'; isAutoChild: boolean }) => {
    const resolve = await routeTo();
    useAppStore.setState({ currentWorkspaceId: WS_ID, phaseTemplates: {} });
    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: GOAL,
      branchPrefix: 'nw',
    });
    const rootAgentId = await useAppStore
      .getState()
      .spawnAgent(session.id, { name: 'Auto', kindOverride: 'auto' });
    const agentId = await useAppStore
      .getState()
      .spawnAgent(session.id, { name: 'Child', kindOverride: params.kind });
    await settle();
    useAppStore.setState((state) => ({
      autoTreeViews: {
        ...state.autoTreeViews,
        [session.id]: params.isAutoChild
          ? [viewWithChild({ rootAgentId, childAgentId: agentId, role: params.kind })]
          : [],
      },
    }));
    runTurnSpy.mockClear();
    return { sessionId: session.id, agentId, resolve };
  };

  it('confines a turn the person types on a Scout child to the Scout role', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout', isAutoChild: true });

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Also list the migrations.',
      origin: 'operator',
    });

    expect(lastRunArgs()?.confinedRole).toBe('scout');
  });

  it('keeps the write role of an Implementer child on a turn the person types', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'implementer', isAutoChild: true });

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Also rename the helper.',
      origin: 'operator',
    });

    expect(lastRunArgs()?.confinedRole).toBe('implementer');
  });

  it('leaves a turn on an agent that is not an Auto child as it was', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout', isAutoChild: false });

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Also list the migrations.',
      origin: 'operator',
    });

    expect(lastRunArgs()?.confinedRole).toBeUndefined();
  });

  it('runs the next delegated turn on the routed model after a composer model change', async () => {
    const { sessionId, agentId, resolve } = await childSession({
      kind: 'implementer',
      isAutoChild: true,
    });
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((candidate) =>
        candidate.id === sessionId
          ? {
              ...candidate,
              providerPreference: { ...candidate.providerPreference, allowTurnOverride: false },
            }
          : candidate,
      ),
      agentProviderOverride: { ...state.agentProviderOverride, [agentId]: 'anthropic' },
      agentModelOverride: { ...state.agentModelOverride, [agentId]: 'claude-sonnet-5' },
    }));

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Continue the implementer that stopped.',
      origin: 'delegation',
      confinedRole: 'implementer',
      override: { providerId: 'anthropic', model: 'claude-haiku-5', explicit: true },
    });

    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        turnOverride: expect.objectContaining({ model: 'claude-haiku-5' }),
      }),
    );
  });
});
