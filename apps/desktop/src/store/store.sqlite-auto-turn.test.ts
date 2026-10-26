import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import {
  brandId,
  type AgentId,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';
import { summarizerQueues } from './slices/turn/turnHelpers';
import type { SendTurnInput } from './slices/turn/types';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

type TurnSettledInfo = Parameters<NonNullable<SendTurnInput['onSettled']>>[0];

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
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
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
let first: { readonly sessionId: SessionId; readonly agentId: AgentId };

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const startAgent = async () => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: 'Reconcile the Harborline ledger export',
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

const saying = (runId: ProviderRunId, text: string) =>
  (async function* stream(): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text', runId, delta: text, at: TEST_NOW };
  })();

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
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue(SCRATCH);
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  first = await startAgent();
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('a delegation turn through the real store', () => {
  it('runs on the planned run id and hands the delivery to the spawn', async () => {
    const planned = brandId<ProviderRunId>({ value: 'run-planned-by-the-scheduler' });
    storySpies.runTurn.mockImplementation(({ runId }: { readonly runId: ProviderRunId }) =>
      saying(runId, 'Here is what I found.'),
    );
    const settled: Array<TurnSettledInfo> = [];

    await useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Delivery from Auto',
      origin: 'delegation',
      runId: planned,
      deliveryId: 'outbox-1',
      onSettled: (info) => {
        settled.push(info);
      },
    });

    const spawn = storySpies.runTurn.mock.calls[0]?.[0];
    expect(spawn).toMatchObject({
      runId: planned,
      deliveryId: 'outbox-1',
    });
    expect(settled).toEqual([
      expect.objectContaining({
        runId: planned,
        assistantText: 'Here is what I found.',
        hasFailed: false,
        wasCancelled: false,
      }),
    ]);
  });

  it('reports a failed turn through the same hook before the error reaches the caller', async () => {
    storySpies.runTurn.mockImplementation(() =>
      (async function* stream(): AsyncIterable<TurnEvent> {
        yield* [];
        throw new Error('the provider process was terminated');
      })(),
    );
    const settled: Array<TurnSettledInfo> = [];

    await useAppStore
      .getState()
      .sendTurn({
        sessionId: first.sessionId,
        agentId: first.agentId,
        content: 'Delivery from Auto',
        origin: 'delegation',
        onSettled: (info) => {
          settled.push(info);
        },
      })
      .catch(() => undefined);

    expect(settled).toEqual([expect.objectContaining({ hasFailed: true, wasCancelled: false })]);
  });

  it('leaves every other turn exactly as it was: a hand delivery id, no tree, no planned run', async () => {
    await useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'A plain message',
    });

    const spawn = storySpies.runTurn.mock.calls[0]?.[0];
    expect(spawn).toBeDefined();
    expect(spawn).toHaveProperty('deliveryId', expect.stringMatching(/^hand:/));
    expect(spawn).not.toHaveProperty('confinedRole');
  });

  it('passes the confined role of an Auto child to the spawn', async () => {
    await useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Kickoff from Auto',
      origin: 'delegation',
      confinedRole: 'reviewer',
      deliveryId: 'attempt-1',
    });

    expect(storySpies.runTurn.mock.calls[0]?.[0]).toMatchObject({
      confinedRole: 'reviewer',
      deliveryId: 'attempt-1',
    });
  });

  it('marks the spawn of an Auto child so the bridge can refuse its pushes', async () => {
    await useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Kickoff from Auto',
      origin: 'delegation',
      confinedRole: 'implementer',
      deliveryId: 'attempt-2',
    });

    expect(storySpies.runTurn.mock.calls[0]?.[0]).toMatchObject({ isAutoChild: true });
  });

  it('leaves the root, a hand-started turn and a plain turn unmarked', async () => {
    await useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Root turn',
      origin: 'delegation',
      confinedRole: 'auto',
      deliveryId: 'attempt-3',
    });
    await useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'A plain message',
    });
    await useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'A confined answer without Auto',
      confinedRole: 'scout',
    });

    for (const call of storySpies.runTurn.mock.calls) {
      expect(call[0]).not.toHaveProperty('isAutoChild');
    }
  });
});
