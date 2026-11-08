import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace, listAgentsForSessions } from '@goodboy/db';
import { liveTestRuns } from '@goodboy/db/test-helpers';
import { nextWorkspaceId } from '@goodboy/types/testing';
import { brandId, type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { claimTurnAdmission } from './slices/turn/childTurn/claimTurnAdmission';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { adoptAgent } from './runtime/auto/adoptAgent';
import { reconcileGhostAgents, reconcileLoadedAgent } from './slices/sessions/reconcileSessionRuns';
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
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
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
const HOLD_MS = 120_000;
const ROUTED = {
  selectedProvider: 'anthropic',
  selectedModel: 'claude-sonnet-4-5',
  reason: 'preferred',
  fallbackUsed: false,
} as const;

type Gate = Readonly<{
  opened: Promise<void>;
  open: () => void;
}>;

const gate = (): Gate => {
  const handle: { open: () => void } = { open: () => undefined };
  const opened = new Promise<void>((resolve) => {
    handle.open = resolve;
  });
  return { opened, open: () => handle.open() };
};

let useAppStore: StoryStore;
let first: { readonly sessionId: SessionId; readonly agentId: AgentId };

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const startAgent = async () => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: 'Find where the Harborline ledger rounding drifts',
    firstAgentKind: 'generic',
  });
  const [agent] = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  await vi.waitFor(() =>
    expect(['running', 'starting']).not.toContain(
      useAppStore.getState().agentTurnState[agent.id]?.kind,
    ),
  );
  return { sessionId: session.id, agentId: agent.id };
};

const adoptInOtherWindow = async () => {
  let counter = 0;
  return adoptAgent({
    db: storySqlite(),
    sessionId: first.sessionId,
    sourceAgentId: first.agentId,
    source: {
      kind: 'scout',
      roleLabel: 'Scout',
      isTurnLive: false,
      goal: 'Find where the Harborline ledger rounding drifts',
      lastReply: 'The drift starts in the batch totals of ledger-core.',
      mountLabel: 'ledger-core',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      effort: 'medium',
    },
    instruction: 'Keep looking at the batch totals.',
    autoRouting: { provider: 'anthropic', model: 'claude-sonnet-4-5', effort: 'medium' },
    primaryMountId: null,
    capUsd: 5,
    nowMs: Date.now(),
    newId: () => {
      counter += 1;
      return `adopt-${counter}`;
    },
  });
};

const storedAgent = async () => {
  const agents = (await listAgentsForSessions(storySqlite(), [first.sessionId])).get(
    first.sessionId,
  );
  const agent = agents?.find((candidate) => candidate.id === first.agentId);
  if (agent === undefined) {
    throw new Error('the agent row is gone');
  }
  return agent;
};

const admittedRuns = async (): Promise<ReadonlyArray<string>> =>
  (
    await storySqlite().select<{ readonly run_id: string }>(
      'SELECT run_id FROM turn_admissions WHERE agent_id = ?',
      [first.agentId],
    )
  ).map((row) => row.run_id);

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
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue(ROUTED);
  storySpies.scratchDirPrepare.mockResolvedValue(SCRATCH);
  stubStoryInvoke({ workspaces_with_unread: [], turn_list_live: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  first = await startAgent();
  storySpies.runTurn.mockClear();
});

afterEach(async () => {
  liveTestRuns.clear();
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('a turn admission outlives another window until the spawn', () => {
  it('keeps the claim when another window reconciles between claim and spawn', async () => {
    const reached = gate();
    const release = gate();
    storySpies.turnSpawn.mockImplementationOnce(async () => {
      reached.open();
      await release.opened;
    });

    const turn = useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Also list the migrations.',
      origin: 'operator',
    });
    await reached.opened;
    const claimed = await storedAgent();
    const booted = await reconcileGhostAgents();
    const loaded = await reconcileLoadedAgent({ agent: claimed, liveRunIds: new Set() });
    const adopted = await adoptInOtherWindow();
    const heldRuns = await admittedRuns();
    release.open();
    await turn;

    expect(booted).toBe(0);
    expect(loaded.agent.status).toBe('running');
    expect(adopted).toMatchObject({ kind: 'refused', code: 'turn_running' });
    expect(heldRuns).toEqual([claimed.runId]);
    expect(storySpies.turnSpawn.mock.calls.at(-1)?.[0]).toMatchObject({ hasAdmission: true });
    expect(storySpies.turnSpawn.mock.calls.at(-1)?.[0]).not.toHaveProperty('isAutoChild');
    await vi.waitFor(async () => expect(await admittedRuns()).toEqual([]));
  });

  it('refuses a second window that claims the agent while the first claim waits to spawn', async () => {
    const reached = gate();
    const release = gate();
    storySpies.turnSpawn.mockImplementationOnce(async () => {
      reached.open();
      await release.opened;
    });

    const turn = useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Also list the migrations.',
      origin: 'operator',
    });
    await reached.opened;
    const claimed = await storedAgent();
    const competing = await claimTurnAdmission({
      agentId: first.agentId,
      delegationId: null,
      runId: brandId<ProviderRunId>({ value: 'run-other-window' }),
    });
    const afterCompeting = await storedAgent();
    const heldRuns = await admittedRuns();
    release.open();
    await turn;
    const afterTurn = await claimTurnAdmission({
      agentId: first.agentId,
      delegationId: null,
      runId: brandId<ProviderRunId>({ value: 'run-after-the-turn' }),
    });

    expect(competing).toBe('turn_running');
    expect(afterCompeting.runId).toBe(claimed.runId);
    expect(heldRuns).toEqual([claimed.runId]);
    expect(storySpies.turnSpawn).toHaveBeenCalledTimes(1);
    expect(afterTurn).toBe('admitted');
  });

  it('keeps a spawn published at the hold boundary from another window reconciling', async () => {
    const reached = gate();
    const release = gate();
    storySpies.turnSpawn.mockImplementationOnce(async () => {
      await storySqlite().execute('UPDATE turn_admissions SET claimed_at = ? WHERE agent_id = ?', [
        Date.now() - HOLD_MS,
        first.agentId,
      ]);
      reached.open();
      await release.opened;
    });

    const turn = useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Also list the migrations.',
      origin: 'operator',
    });
    await reached.opened;
    const claimed = await storedAgent();
    const booted = await reconcileGhostAgents();
    const loaded = await reconcileLoadedAgent({ agent: claimed, liveRunIds: new Set() });
    const adopted = await adoptInOtherWindow();
    const heldRuns = await admittedRuns();
    release.open();
    await turn;

    expect(booted).toBe(0);
    expect(loaded.agent.status).toBe('running');
    expect(adopted).toMatchObject({ kind: 'refused', code: 'turn_running' });
    expect(heldRuns).toEqual([claimed.runId]);
    expect(storySpies.turnSpawn.mock.calls.at(-1)?.[0]).toMatchObject({ hasAdmission: true });
  });

  it('leaves a run that spawned after another window read the live runs', async () => {
    const streaming = gate();
    const release = gate();
    storySpies.turnSpawn.mockImplementationOnce(async () => {
      for (const runId of await admittedRuns()) {
        liveTestRuns.add(runId);
      }
      return 'started';
    });
    storySpies.runTurn.mockImplementationOnce(async function* held() {
      streaming.open();
      await release.opened;
      yield* emptyTurnStream();
    });

    const turn = useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Also list the migrations.',
      origin: 'operator',
    });
    await streaming.opened;
    await vi.waitFor(async () => expect(await admittedRuns()).toEqual([]));
    const spawned = await storedAgent();
    const booted = await reconcileGhostAgents();
    const loaded = await reconcileLoadedAgent({ agent: spawned, liveRunIds: new Set() });
    const adopted = await adoptInOtherWindow();
    const afterCleanup = await storedAgent();
    release.open();
    await turn;

    expect(booted).toBe(0);
    expect(loaded.agent.status).toBe('running');
    expect(afterCleanup.status).toBe('running');
    expect(adopted).toMatchObject({ kind: 'refused', code: 'turn_running' });
    expect(storySpies.turnSpawn).toHaveBeenCalledTimes(1);
  });

  it('gives the claim back when the turn fails before it spawns', async () => {
    storySpies.turnSpawn.mockRejectedValueOnce(
      new Error('the claim for run run-1 is gone, so the turn did not start'),
    );

    await useAppStore
      .getState()
      .sendTurn({
        sessionId: first.sessionId,
        agentId: first.agentId,
        content: 'Also list the migrations.',
        origin: 'operator',
      })
      .catch((error: unknown) => error);

    expect(await admittedRuns()).toEqual([]);
  });

  it('stops at boot an agent whose claim an earlier launch left behind', async () => {
    const agent = await storedAgent();
    await storySqlite().execute(
      "UPDATE agents SET status = 'running', provider_run_id = 'run-crashed' WHERE id = ?",
      [agent.id],
    );
    await storySqlite().execute(
      `INSERT INTO turn_admissions
         (id, agent_id, run_id, owner_launch, claimed_at, created_at, updated_at)
       VALUES (?, ?, 'run-crashed', 'launch-before-the-crash', ?, ?, ?)`,
      [agent.id, agent.id, Date.now(), Date.now(), Date.now()],
    );

    expect(await reconcileGhostAgents()).toBe(1);
    expect((await storedAgent()).status).toBe('stopped');
    expect(await admittedRuns()).toEqual([]);
    expect((await adoptInOtherWindow()).kind).toBe('adopted');
  });
});
