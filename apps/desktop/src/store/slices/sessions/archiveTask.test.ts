import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { summarizerQueues } from '../turn/turnHelpers';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
});

let useAppStore: StoryStore;
let sessionId: SessionId;
let agentId: AgentId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type GateHandle = Readonly<{
  opened: Promise<void>;
  open: () => void;
}>;

const gate = (): GateHandle => {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
};

type RunArgs = Readonly<{
  runId: ProviderRunId;
}>;

type StartParams = Readonly<{
  hold: Promise<void>;
}>;

type Streaming = Readonly<{
  pending: Promise<unknown>;
}>;

const startStreaming = async ({ hold }: StartParams): Promise<Streaming> => {
  storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
    (async function* stream(): AsyncIterable<TurnEvent> {
      yield {
        kind: 'assistant_text',
        runId,
        delta: 'Reading the ledger-core export',
        at: TEST_NOW,
      };
      await hold;
    })(),
  );
  const pending = useAppStore.getState().sendTurn({
    sessionId,
    agentId,
    content: 'Reconcile the Harborline ledger export',
  });
  await vi.waitFor(() =>
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('running'),
  );
  return { pending };
};

const runningRunId = (): ProviderRunId => {
  const turn = useAppStore.getState().agentTurnState[agentId];
  if (turn?.kind !== 'running') {
    throw new Error('the agent is not running');
  }
  return turn.runId;
};

const agentStatus = async (): Promise<string | undefined> =>
  (
    await rowsOf<{ status: string }>({
      sql: 'SELECT status FROM agents WHERE id = ?',
      params: [agentId],
    })
  )[0]?.status;

const archivedAt = async (): Promise<number | null | undefined> =>
  (
    await rowsOf<{ archived_at: number | null }>({
      sql: 'SELECT archived_at FROM sessions WHERE id = ?',
      params: [sessionId],
    })
  )[0]?.archived_at;

const boardIds = (): ReadonlyArray<string> =>
  useAppStore.getState().sessions.map((session) => session.id);

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
  const routingMod = await import('../../../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({ workspaces_with_unread: [], workflows_for_session: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: 'Reconcile the Harborline ledger export',
    firstAgentKind: 'generic',
  });
  sessionId = session.id;
  const [agent] = useAppStore.getState().sessionPhaseRuns[sessionId] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  agentId = agent.id;
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('archiveTask stops live work first', () => {
  it('archives an idle session at once, and Undo brings it back', async () => {
    await useAppStore.getState().archiveTask(sessionId);

    expect(boardIds()).toEqual([]);
    expect(await archivedAt()).not.toBeNull();
    expect(storySpies.cancelTurn).not.toHaveBeenCalled();

    await useAppStore.getState().unarchiveTask(sessionId);

    expect(boardIds()).toEqual([sessionId]);
    expect(await archivedAt()).toBeNull();
  });

  it('stops a running agent before the archive, and Undo brings back a stopped agent', async () => {
    const hold = gate();
    const live = new Set<string>();
    storySpies.listLiveRunIds.mockImplementation(async () => live);
    storySpies.cancelTurn.mockImplementation(async () => {
      live.clear();
      hold.open();
    });
    const { pending } = await startStreaming({ hold: hold.opened });
    live.add(runningRunId());

    await useAppStore.getState().archiveTask(sessionId);
    await pending;

    expect(storySpies.cancelTurn).toHaveBeenCalledOnce();
    expect(await agentStatus()).toBe('stopped');
    expect(boardIds()).toEqual([]);

    await useAppStore.getState().unarchiveTask(sessionId);

    expect(boardIds()).toEqual([sessionId]);
    expect(await agentStatus()).toBe('stopped');
  });

  it('leaves the session where it was when an agent does not stop', async () => {
    const hold = gate();
    const live = new Set<string>();
    storySpies.listLiveRunIds.mockImplementation(async () => live);
    storySpies.cancelTurn.mockRejectedValue(new Error('kill refused'));
    const { pending } = await startStreaming({ hold: hold.opened });
    live.add(runningRunId());

    await expect(useAppStore.getState().archiveTask(sessionId)).rejects.toThrow(
      'An agent did not stop',
    );

    expect(boardIds()).toEqual([sessionId]);
    expect(await archivedAt()).toBeNull();
    expect(await agentStatus()).toBe('running');
    hold.open();
    await pending;
  });
});
