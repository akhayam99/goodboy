import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSessionContextItems, insertWorkspace, upsertContextSlot } from '@goodboy/db';
import type {
  AgentId,
  AgentRole,
  IsoDateTime,
  ProviderRunId,
  SessionContextItemId,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import type { AgentKind } from '../features/session/agent-kind';
import { SETTING_CONTEXT_LEARNINGS, SETTING_CONTEXT_ROLE_MAP } from '../features/settings/settings';
import { learningQueues } from './slices/turn/learningQueue';
import { summarizerQueues } from './slices/turn/turnHelpers';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySummarizeSession,
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

const PROFILE = {
  roles: ['Tech Lead'],
  aboutWork: null,
  workingRules: null,
  explainMore: ['Rust'],
};
const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const LEARNING_PROMPT = 'Extract explanations';
const EXPLAINED = {
  topic: 'Rust',
  title: 'Why select! can drop a half-sent request',
  text: 'select! cancels every branch that did not win, so a losing request is dropped mid-write.',
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const ACTIVE_TURN: ReadonlySet<string> = new Set(['starting', 'running']);

const isTurnActive = ({ agentId }: { readonly agentId: AgentId }): boolean =>
  ACTIVE_TURN.has(useAppStore.getState().agentTurnState[agentId]?.kind ?? 'idle');

async function* explainingStream({
  runId,
}: {
  readonly runId: ProviderRunId;
}): AsyncIterable<TurnEvent> {
  yield { kind: 'assistant_text', runId, delta: EXPLAINED.text, at: AT };
}

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
  if (kind !== 'generic') {
    await vi.waitFor(() =>
      expect(useAppStore.getState().agentTurnState[agent.id]?.kind).toBe('idle'),
    );
  }
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
  storySpies.runTurn.mockImplementation(({ runId }: { readonly runId: ProviderRunId }) =>
    explainingStream({ runId }),
  );
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
  await vi.waitFor(() => expect(learningQueues.size).toBe(0));
});

type AuxCall = {
  readonly args: {
    readonly providerId: string;
    readonly systemPrompt: string;
    readonly userMessage: string;
  };
};

const summarizeStep = storySummarizeSession('The step finished.');

const answerLearnings = ({
  items,
  hold,
}: {
  readonly items: ReadonlyArray<Record<string, unknown>>;
  readonly hold?: Promise<void>;
}) => {
  const calls: Array<string> = [];
  stubStoryInvoke({
    workspaces_with_unread: [],
    summarize_session: async (call: AuxCall) => {
      if (!call.args.systemPrompt.startsWith(LEARNING_PROMPT)) {
        return summarizeStep(call);
      }
      calls.push(call.args.userMessage);
      if (hold !== undefined) {
        await hold;
      }
      return {
        stdout: JSON.stringify({ result: JSON.stringify({ items }), subtype: 'success' }),
        stderr: '',
        exitCode: 0,
      };
    },
  });
  return calls;
};

const withProfile = () =>
  useAppStore.setState({ workspaces: [{ ...workspace, profile: PROFILE }] });

const learningRows = () =>
  rowsOf<{ topic: string; title: string; source_json: string; audience_json: string }>({
    sql: "SELECT topic, title, source_json, audience_json FROM session_context_items WHERE kind = 'learning'",
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

describe('learnings on sqlite', () => {
  it('writes a learning when an agent explained a topic you follow', async () => {
    withProfile();
    const calls = answerLearnings({ items: [EXPLAINED] });
    const started = await startSession({ kind: 'generic' });

    await promptOf(started);

    await vi.waitFor(async () => expect(await learningRows()).toHaveLength(1));
    const [row] = await learningRows();
    expect(row).toMatchObject({ topic: 'Rust', title: EXPLAINED.title, audience_json: '[]' });
    expect(JSON.parse(row?.source_json ?? '{}')).toMatchObject({ role: 'custom' });
    expect(calls.at(-1)).toContain('Topics: Rust');
    const items = useAppStore.getState().sessionContextItems[started.sessionId] ?? [];
    expect(items.filter((item) => item.kind === 'learning').map((item) => item.title)).toEqual([
      EXPLAINED.title,
    ]);
  });

  it('writes nothing when the turn explained none of the topics', async () => {
    withProfile();
    const calls = answerLearnings({ items: [] });

    await promptOf(await startSession({ kind: 'generic' }));

    await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await vi.waitFor(() => expect(learningQueues.size).toBe(0));
    expect(await learningRows()).toEqual([]);
  });

  it('never runs with the field empty, for a role without the line, or with the switch off', async () => {
    const calls = answerLearnings({ items: [EXPLAINED] });
    await promptOf(await startSession({ kind: 'generic' }));

    withProfile();
    await promptOf(await startSession({ kind: 'implementer' }));

    useAppStore.setState({ settings: { [SETTING_CONTEXT_LEARNINGS]: 'false' } });
    await promptOf(await startSession({ kind: 'generic' }));

    await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
    expect(learningQueues.size).toBe(0);
    expect(calls).toEqual([]);
    expect(await learningRows()).toEqual([]);
  });

  it('settles the turn and finishes the summary while the learnings are still running', async () => {
    withProfile();
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls = answerLearnings({ items: [EXPLAINED], hold });
    const started = await startSession({ kind: 'generic' });

    await promptOf(started);

    await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
    expect(learningQueues.get(started.agentId)?.isRunning).toBe(true);
    expect(isTurnActive({ agentId: started.agentId })).toBe(false);
    expect(await learningRows()).toEqual([]);

    release();
    await vi.waitFor(async () => expect(await learningRows()).toHaveLength(1));
  });
});
