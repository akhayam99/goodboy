import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { nextWorkspaceId } from '@goodboy/types/testing';
import type { AgentId, SessionId } from '@goodboy/types';
import { createRealAutoPorts } from './runtime/auto/createRealAutoPorts';
import { WORLD_TREE } from './runtime/auto/testing/autoWorld';
import { summarizerQueues } from './slices/turn/turnHelpers';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
});
const SCRATCH = '/tmp/goodboy-root/scratch/harborline';

let useAppStore: StoryStore;
let sessionId: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await insertWorkspace({ db: await openStorySqlite(), workspace });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    projects: [],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const budget = await import('../features/budget/budget');
  vi.mocked(budget.invokeCheckProviderBudget).mockResolvedValue({
    remainingUsd: null,
    pct: 0,
    exceeded: false,
    overThreshold: false,
    spentUsd: 0,
    capUsd: null,
    thresholdPct: null,
    windowStartMs: 0,
    windowEndMs: 0,
  });
  storySpies.scratchDirPrepare.mockResolvedValue(SCRATCH);
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: 'Reconcile the Harborline ledger export',
  });
  sessionId = session.id;
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const startLead = (): Promise<AgentId> =>
  useAppStore.getState().spawnAgent(sessionId, { name: 'Lead', kindOverride: 'auto' });

const restartApp = (): void => {
  useAppStore.setState({
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    agentKindOverride: {},
    sessionPhaseRuns: {},
    agentTurnState: {},
  });
};

type LeadTurnParams = {
  readonly agentId: AgentId;
};

const deliverToLead = async ({ agentId }: LeadTurnParams) => {
  const ports = createRealAutoPorts({
    db: storySqlite(),
    getState: useAppStore.getState,
    sendTurn: (input) => useAppStore.getState().sendTurn(input),
    cancelTurnConfirmed: (params) => useAppStore.getState().cancelTurnConfirmed(params),
    loadSessionMounts: async () => [],
    refreshAgents: async () => undefined,
    refreshSessionArtifacts: async () => undefined,
    lookupDeliveryRun: async () => ({ runId: 'run-lead', isLive: true }),
    worktreeSnapshot: async () => ({ head: 'abc123', entries: [], isPartial: false }),
    worktreeDiffRange: async () => '',
    worktreeDiffFromMergeBase: async () => '',
    worktreeCommitRange: async () => [],
    worktreeStatus: async () => ({ branch: 'ak/ledger-export' }),
    worktreeRemoteHead: async () => null,
    listLiveRunIds: async () => new Set<string>(),
    isPlanApprovalRequired: () => true,
    sleep: async () => undefined,
    nowMs: Date.now,
    newId: () => crypto.randomUUID(),
  });
  storySpies.runTurn.mockClear();
  await ports.startAutoTurn({
    treeId: WORLD_TREE,
    agentId,
    sessionId,
    generation: 1,
    runId: 'run-lead',
    deliveryId: 'outbox-lead',
    text: 'The scout came back.',
    onEnded: () => undefined,
  });
  await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalled());
  return storySpies.runTurn.mock.calls[0]?.[0];
};

describe('the model a Lead turn runs on', () => {
  it('is Sonnet 5.5 for a new Lead, also after a restart', async () => {
    const agentId = await startLead();
    restartApp();

    expect(await deliverToLead({ agentId })).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
    });
  });

  it('stays the model the user picked, also after a restart', async () => {
    const agentId = await startLead();
    await useAppStore.getState().setAgentConfig(sessionId, agentId, { modelOverride: 'haiku-5.5' });
    restartApp();

    expect(await deliverToLead({ agentId })).toMatchObject({ model: 'claude-haiku-5-5' });
  });

  it('runs a pick made while the app is open on the next turn', async () => {
    const agentId = await startLead();
    await useAppStore.getState().setAgentConfig(sessionId, agentId, { modelOverride: 'opus-5.5' });

    expect(await deliverToLead({ agentId })).toMatchObject({ model: 'claude-opus-5-5' });
  });
});
