import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSessionContextItems, insertWorkspace, upsertContextSlot } from '@goodboy/db';
import type {
  AgentId,
  AgentRole,
  IsoDateTime,
  SessionContextItemId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { AgentKind } from '../features/session/agent-kind';
import { SETTING_CONTEXT_ROLE_MAP } from '../features/settings/settings';
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

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const AT = '2026-10-03T09:00:00.000Z' as IsoDateTime;
const NOTE = 'Check the retry schedule against the Acme receiver';
const DECISION = 'D1 Retry up to five times with exponential backoff';

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type Started = { readonly sessionId: SessionId; readonly agentId: AgentId };

const startSession = async ({ kind }: { readonly kind: AgentKind }): Promise<Started> => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Retry failed webhook deliveries',
    firstAgentKind: kind,
  });
  const sessionId = session.id as SessionId;
  const [agent] = useAppStore.getState().sessionPhaseRuns[sessionId] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  await vi.waitFor(() =>
    expect(useAppStore.getState().agentTurnState[agent.id]?.kind ?? 'idle').toBe('idle'),
  );
  const decisions = { key: 'decisions', value: DECISION, enabled: true } as const;
  await upsertContextSlot(storySqlite(), sessionId, decisions);
  useAppStore.setState((state) => ({
    sessionSlots: {
      ...state.sessionSlots,
      [sessionId]: [...(state.sessionSlots[sessionId] ?? []), decisions],
    },
  }));
  await insertSessionContextItems({
    db: storySqlite(),
    items: [
      {
        id: `note-${sessionId}` as SessionContextItemId,
        sessionId,
        workspaceId: WORKSPACE_ID,
        kind: 'note',
        title: 'Reviewer check',
        text: NOTE,
        topic: null,
        source: null,
        audience: ['reviewer'] satisfies ReadonlyArray<AgentRole>,
        status: 'active',
        createdAt: AT,
      },
    ],
  });
  return { sessionId, agentId: agent.id };
};

const promptOf = async ({ sessionId, agentId }: Started): Promise<string> => {
  storySpies.runTurn.mockClear();
  await useAppStore.getState().sendTurn({ sessionId, agentId, content: 'Go ahead' });
  const call = storySpies.runTurn.mock.calls.at(-1)?.[0] as { readonly prompt: string } | undefined;
  return call?.prompt ?? '';
};

beforeEach(async () => {
  await resetStoryStore();
  await insertWorkspace({ db: await openStorySqlite(), workspace });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [],
    archivedSessions: {},
    settings: {},
    ...connectedAnthropicState(),
  });
  const routingMod = await import('../features/providers/routing');
  (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preference',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('role context on sqlite', () => {
  it('sends a reviewer-only note and the decisions to the reviewer', async () => {
    const prompt = await promptOf(await startSession({ kind: 'reviewer' }));

    expect(prompt).toContain(NOTE);
    expect(prompt).toContain(DECISION);
  });

  it('keeps the reviewer-only note out of the implementer prompt', async () => {
    const prompt = await promptOf(await startSession({ kind: 'implementer' }));

    expect(prompt).toContain(DECISION);
    expect(prompt).not.toContain(NOTE);
  });

  it('goes back to the kind map with context.roleMap off', async () => {
    useAppStore.setState({ settings: { [SETTING_CONTEXT_ROLE_MAP]: 'false' } });

    const prompt = await promptOf(await startSession({ kind: 'reviewer' }));

    expect(prompt).not.toContain(NOTE);
    expect(prompt).not.toContain(DECISION);
  });
});
