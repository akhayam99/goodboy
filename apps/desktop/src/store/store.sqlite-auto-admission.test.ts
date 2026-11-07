import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { nextWorkspaceId } from '@goodboy/types/testing';
import type { AgentId, SessionId, TurnEvent } from '@goodboy/types';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { adoptAgent } from './runtime/auto/adoptAgent';
import { turnRefusalMessage } from './slices/turn/refusal/turnRefusalMessage';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  injectDbFault,
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

type HeldStreamParams = Readonly<{
  hold: Promise<void>;
}>;

async function* heldStream({ hold }: HeldStreamParams): AsyncIterable<TurnEvent> {
  await hold;
  yield* [];
}

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

type AdoptParams = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

const adoptInOtherWindow = async ({ sessionId, agentId }: AdoptParams) => {
  let counter = 0;
  return adoptAgent({
    db: storySqlite(),
    sessionId,
    sourceAgentId: agentId,
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
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  first = await startAgent();
  storySpies.runTurn.mockClear();
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('a turn and an adoption from another window never cross', () => {
  it('refuses a launch whose agent was adopted after its membership was read', async () => {
    const routingMod = await import('../features/providers/routing');
    const routed = gate();
    const reached = gate();
    vi.mocked(routingMod.resolveProviderForTurn).mockImplementationOnce(async () => {
      reached.open();
      await routed.opened;
      return ROUTED;
    });

    const turn = useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Also list the migrations.',
      origin: 'operator',
    });
    await reached.opened;
    const adopted = await adoptInOtherWindow(first);
    routed.open();
    const result = await turn;

    expect(adopted.kind).toBe('adopted');
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(result.autoChildRefusal).toBe('auto_child_changed');
    expect(
      (useAppStore.getState().transcripts[first.agentId] ?? []).flatMap((event) =>
        event.kind === 'error' ? [event.message] : [],
      ),
    ).toContain(turnRefusalMessage({ refusal: 'auto_child_changed' }));
  });

  it('refuses the adoption while a launched turn holds its admission', async () => {
    const spawned = gate();
    const release = gate();
    storySpies.runTurn.mockImplementationOnce(() => {
      spawned.open();
      return heldStream({ hold: release.opened });
    });

    const turn = useAppStore.getState().sendTurn({
      sessionId: first.sessionId,
      agentId: first.agentId,
      content: 'Also list the migrations.',
      origin: 'operator',
    });
    await spawned.opened;
    const adopted = await adoptInOtherWindow(first);
    release.open();
    await turn;

    expect(adopted).toMatchObject({ kind: 'refused', code: 'turn_running' });
    expect(storySpies.runTurn.mock.calls[0]?.[0]).not.toHaveProperty('isAutoChild');
  });

  it('frees the agent when its status write fails after the claim', async () => {
    injectDbFault({ match: /last_finished_at = CASE WHEN/ });

    await expect(
      useAppStore.getState().sendTurn({
        sessionId: first.sessionId,
        agentId: first.agentId,
        content: 'Also list the migrations.',
        origin: 'operator',
      }),
    ).rejects.toThrow('injected db fault');

    const rows = await storySqlite().select<{ readonly status: string }>(
      'SELECT status FROM agents WHERE id = ?',
      [first.agentId],
    );
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(rows[0]?.status).not.toBe('running');
    expect((await adoptInOtherWindow(first)).kind).toBe('adopted');
  });
});
