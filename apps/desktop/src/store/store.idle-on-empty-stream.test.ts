import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_HEALTH_MAP } from './slices/providers/providerHealth';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type {
  Agent,
  AgentId,
  AgentTurnSpan,
  IsoDateTime,
  MountId,
  ProjectId,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import { decodeAuthRequiredMessage } from '../features/chat/turn';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => {
  const actual =
    await vi.importActual<typeof import('../features/chat/turn')>('../features/chat/turn');
  return {
    ...(await import('./storyHarness')).turnModuleMock(),
    encodeAuthRequiredMessage: actual.encodeAuthRequiredMessage,
    decodeAuthRequiredMessage: actual.decodeAuthRequiredMessage,
  };
});
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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const runTurnSpy = storySpies.runTurn;

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

function buildSession(): Session {
  const now = '2026-05-08T00:00:00.000Z' as IsoDateTime;
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test',
    state: { kind: 'idle', lastActivityAt: now },
    contextSlots: [],
    providerPreference: {
      defaultProvider: 'anthropic',
      allowTurnOverride: false,
    },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function* emptyStream(): AsyncIterable<TurnEvent> {}

async function* doneOnlyStream(runId: ProviderRunId): AsyncIterable<TurnEvent> {
  yield {
    kind: 'done',
    runId,
    at: '2026-05-08T00:00:01.000Z' as IsoDateTime,
  };
}

async function* answerStream(runId: ProviderRunId): AsyncIterable<TurnEvent> {
  yield {
    kind: 'assistant_text',
    runId,
    delta: 'done',
    at: '2026-05-08T00:00:01.000Z' as IsoDateTime,
  };
}

async function* throwingStream(runId: ProviderRunId): AsyncIterable<TurnEvent> {
  yield {
    kind: 'assistant_text',
    runId,
    delta: 'partial',
    at: '2026-05-08T00:00:01.000Z' as IsoDateTime,
  };
  throw new Error('provider crashed mid-stream');
}

const OAUTH_EXPIRED_MESSAGE =
  'Failed to authenticate. API Error: 401 {"type":"error","error":{"type":"authentication_error","message":"OAuth access token has expired. Re-authenticate to continue."},"request_id":null}';

const MAX_MODE_MESSAGE =
  'ActionRequiredError: Max Mode Required  The model "gpt-5.5-high" requires Max Mode to be enabled.';

async function* authErrorEventStream(runId: ProviderRunId): AsyncIterable<TurnEvent> {
  yield {
    kind: 'error',
    runId,
    message: OAUTH_EXPIRED_MESSAGE,
    at: '2026-05-08T00:00:01.000Z' as IsoDateTime,
  };
}

async function* throwingAuthErrorStream(runId: ProviderRunId): AsyncIterable<TurnEvent> {
  yield {
    kind: 'assistant_text',
    runId,
    delta: 'partial',
    at: '2026-05-08T00:00:01.000Z' as IsoDateTime,
  };
  throw new Error(OAUTH_EXPIRED_MESSAGE);
}

type ErrorStreamParams = {
  readonly message: string;
};

const throwingErrorStream = async function* ({
  message,
}: ErrorStreamParams): AsyncIterable<TurnEvent> {
  throw new Error(message);
};

async function* nonAuthErrorEventStream(runId: ProviderRunId): AsyncIterable<TurnEvent> {
  yield {
    kind: 'error',
    runId,
    message: 'connection reset by peer',
    at: '2026-05-08T00:00:01.000Z' as IsoDateTime,
  };
}

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('sendTurn, terminal state guarantees', () => {
  beforeEach(async () => {
    resetStorySpies();
    runTurnSpy.mockImplementation(() => emptyStream());
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-3-5-sonnet-latest',
      reason: 'preference',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setupSession(useAppStore: Awaited<ReturnType<typeof importStore>>) {
    const defaultAgent: Agent = {
      id: 'agent-1' as AgentId,
      sessionId: SESSION_ID,
      ordinal: 0,
      name: 'agent 1',
      status: 'pending',
    };
    useAppStore.setState({
      sessions: [buildSession()],
      sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            projectId: 'project-turn' as ProjectId,
            mountName: 'repo',
            worktreePath: '/tmp/wt',
            repoRoot: '/tmp/repo',
            branch: 'goodboy/turn',
            mountId: 'mount-fixture-1' as MountId,
            sessionId: SESSION_ID,
            lastWorktreePath: null,
            baseBranch: null,
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 0,
          },
        ],
      },
      sessionPhaseRuns: { [SESSION_ID]: [defaultAgent] },
      selectedAgentId: { [SESSION_ID]: defaultAgent.id },
      transcripts: {},
      providers: [
        {
          id: 'anthropic',
          binary: 'claude',
          connection: 'connected',
          name: 'Claude',
          installation: 'installed',
        } as never,
      ],
      authResults: {
        anthropic: { state: 'connected', identity: 'test' },
        cursor: { state: 'connected', identity: 'test' },
        codex: { state: 'connected', identity: 'test' },
      } as never,
      workspaces: [
        {
          id: WORKSPACE_ID,
          name: 'ws',
          slug: 'ws',
          overrides: {
            defaultProviderId: null,
            defaultBranchPrefix: null,
            defaultVerbosity: null,
            providerBindings: null,
            taskModels: null,
            roleModels: null,
            parallelAgents: null,
            providerPool: null,
            attributionFooter: null,
            replyVoice: null,
            replyStyleNote: null,
            replyTemplateFixed: null,
            replyTemplateNoChange: null,
            resolveOnGithub: null,
            resolveCommitStyle: null,
            afterMerge: null,
            defaultBranchTemplate: null,
          },
          createdAt: '2026-05-08T00:00:00.000Z' as IsoDateTime,
          updatedAt: '2026-05-08T00:00:00.000Z' as IsoDateTime,
        },
      ],
    });
  }

  it('transitions session to idle after stream ends without a done event', async () => {
    runTurnSpy.mockImplementation(() => emptyStream());
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hello' });

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('idle');
  });

  it('emits a scoped warning near the context limit and still runs the turn', async () => {
    runTurnSpy.mockImplementation(() => emptyStream());
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-haiku-4-5',
      reason: 'preference',
    });
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      content: 'x'.repeat(680_000),
    });

    expect(runTurnSpy).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(useAppStore.getState().notifications).toEqual([
        expect.objectContaining({
          kind: 'error',
          severity: 'warning',
          sessionId: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          coalesceKey: `context-soft-cap:${SESSION_ID}`,
        }),
      ]);
    });
  });

  it('appends an error event when the stream ends with no assistant text', async () => {
    runTurnSpy.mockImplementation(() => emptyStream());
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hello' });

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const errorEvent = transcript.find((e) => e.kind === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent && 'message' in errorEvent ? errorEvent.message : '').toMatch(
      /provider exited without a response/i,
    );
    expect(errorEvent && 'retryable' in errorEvent ? errorEvent.retryable : undefined).not.toBe(
      true,
    );
  });

  it('appends user_text event so the user message is visible immediately', async () => {
    runTurnSpy.mockImplementation(() => emptyStream());
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'ciao mondo' });

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const userEvent = transcript.find((e) => e.kind === 'user_text');
    expect(userEvent).toBeDefined();
    expect(userEvent && 'text' in userEvent ? userEvent.text : '').toBe('ciao mondo');
  });

  it('does not append a duplicate error event when the stream emits a done event', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) => doneOnlyStream(args.runId));
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hi' });

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('idle');

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const errorEvents = transcript.filter((e) => e.kind === 'error');
    expect(errorEvents).toHaveLength(0);
  });

  it('records a measured span for a turn that answered', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) => answerStream(args.runId));
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hi' });

    const db = await import('@goodboy/db');
    const insertSpan = db.insertAgentTurnSpan as ReturnType<typeof vi.fn>;
    expect(insertSpan).toHaveBeenCalledOnce();
    const [{ span }] = insertSpan.mock.calls[0] as [{ span: AgentTurnSpan }];
    expect(span).toMatchObject({
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
      workspaceId: WORKSPACE_ID,
      workflowRunId: null,
      stepRole: 'custom',
      provider: 'anthropic',
      endReason: 'succeeded',
      touchedMountIds: [],
    });
    expect(Date.parse(span.endedAt)).toBeGreaterThanOrEqual(Date.parse(span.startedAt));
  });

  it('records a failed span once when the stream throws mid-turn', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) => throwingStream(args.runId));
    setupSession(useAppStore);

    await expect(
      useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'boom' }),
    ).rejects.toThrow('provider crashed mid-stream');

    const db = await import('@goodboy/db');
    const insertSpan = db.insertAgentTurnSpan as ReturnType<typeof vi.fn>;
    expect(insertSpan).toHaveBeenCalledOnce();
    expect(insertSpan.mock.calls[0]?.[0]).toMatchObject({ span: { endReason: 'failed' } });
  });

  it('transitions session to error and rethrows when the stream throws mid-turn', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) => throwingStream(args.runId));
    setupSession(useAppStore);

    await expect(
      useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'boom' }),
    ).rejects.toThrow('provider crashed mid-stream');

    const session = useAppStore.getState().sessions.find((s) => s.id === SESSION_ID);
    expect(session?.state.kind).toBe('error');

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const errorEvents = transcript.filter((e) => e.kind === 'error');
    expect(errorEvents).toHaveLength(1);
    const errorEvent = errorEvents[0];
    expect(errorEvent && 'message' in errorEvent ? errorEvent.message : '').toMatch(
      /provider crashed mid-stream/i,
    );
    expect(errorEvent && 'retryable' in errorEvent ? errorEvent.retryable : undefined).toBe(true);
  });

  it('marks the provider run failed when the stream throws mid-turn', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) => throwingStream(args.runId));

    const { updateProviderRunStatus } = await import('@goodboy/db');
    (updateProviderRunStatus as ReturnType<typeof vi.fn>).mockClear();
    setupSession(useAppStore);

    await expect(
      useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'boom' }),
    ).rejects.toThrow();

    const statuses = (updateProviderRunStatus as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[2] as { kind: string }).kind,
    );
    expect(statuses).toContain('failed');
  });

  it('encodes a stream error event carrying the OAuth 401 text as auth_required, not a raw error item', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) =>
      authErrorEventStream(args.runId),
    );
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hello' });

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const errorEvent = transcript.find((e) => e.kind === 'error');
    const message = errorEvent && 'message' in errorEvent ? errorEvent.message : '';
    expect(message).toMatch(/^__auth_required__:/);
    expect(decodeAuthRequiredMessage(message)).toEqual({
      providerId: 'anthropic',
      identity: 'test',
    });
  });

  it('encodes a thrown OAuth 401 error the same way as a stream error event', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) =>
      throwingAuthErrorStream(args.runId),
    );
    setupSession(useAppStore);

    await expect(
      useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'boom' }),
    ).rejects.toThrow();

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const errorEvent = transcript.find((e) => e.kind === 'error');
    const message = errorEvent && 'message' in errorEvent ? errorEvent.message : '';
    expect(decodeAuthRequiredMessage(message)).toEqual({
      providerId: 'anthropic',
      identity: 'test',
    });
  });

  it('counts a streamed OAuth 401 as one refused run for the provider', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) =>
      authErrorEventStream(args.runId),
    );
    useAppStore.setState({ providerHealth: INITIAL_HEALTH_MAP });
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hello' });

    const health = useAppStore.getState().providerHealth.anthropic;
    expect(health.refusals).toHaveLength(1);
    expect(health.evidence.lastRunOutcome).toBe('refused');
  });

  it('counts a thrown OAuth 401 as one refused run for the provider', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) =>
      throwingAuthErrorStream(args.runId),
    );
    useAppStore.setState({ providerHealth: INITIAL_HEALTH_MAP });
    setupSession(useAppStore);

    await expect(
      useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'boom' }),
    ).rejects.toThrow();

    expect(useAppStore.getState().providerHealth.anthropic.refusals).toHaveLength(1);
  });

  it('opens the breaker on the provider list after three refused runs', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) =>
      authErrorEventStream(args.runId),
    );
    useAppStore.setState({ providerHealth: INITIAL_HEALTH_MAP });
    setupSession(useAppStore);

    for (let turn = 0; turn < 3; turn += 1) {
      await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: `hello ${turn}` });
    }

    const claude = useAppStore.getState().providers.find((p) => p.id === 'anthropic');
    expect(useAppStore.getState().providerHealth.anthropic.isBreakerOpen).toBe(true);
    expect(claude?.isBreakerOpen).toBe(true);
  });

  it('closes the breaker when a run is accepted', async () => {
    useAppStore.setState({ providerHealth: INITIAL_HEALTH_MAP });
    setupSession(useAppStore);
    for (let turn = 0; turn < 3; turn += 1) {
      runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) =>
        authErrorEventStream(args.runId),
      );
      await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: `hello ${turn}` });
    }
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) => answerStream(args.runId));

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'again' });

    const health = useAppStore.getState().providerHealth.anthropic;
    expect(health.isBreakerOpen).toBe(false);
    expect(health.evidence.lastRunOutcome).toBe('accepted');
  });

  it('surfaces the model and Max Mode action when the child exits with Max Mode stderr', async () => {
    runTurnSpy.mockImplementation(() => throwingErrorStream({ message: MAX_MODE_MESSAGE }));
    setupSession(useAppStore);
    const routingMod = await import('../features/providers/routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      selectedProvider: 'cursor',
      selectedModel: 'gpt-5.5-high',
      reason: 'preference',
    });

    await expect(
      useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'boom' }),
    ).rejects.toThrow(MAX_MODE_MESSAGE);

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const errorEvent = transcript.find((event) => event.kind === 'error');
    const message = errorEvent && 'message' in errorEvent ? errorEvent.message : '';
    expect(message).toContain('gpt-5.5-high');
    expect(message).toContain('usage-based pricing');
    expect(message).not.toContain('CLI is configured correctly');
    expect(runTurnSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ model: 'gpt-5.5-high', cursorMaxMode: true }),
    );
    const turnState = useAppStore.getState().agentTurnState[AGENT_ID];
    expect(turnState?.kind).toBe('error');
  });

  it('leaves a non-auth provider error event message verbatim', async () => {
    runTurnSpy.mockImplementation((args: { runId: ProviderRunId }) =>
      nonAuthErrorEventStream(args.runId),
    );
    setupSession(useAppStore);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'hello' });

    const transcript = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const errorEvent = transcript.find((e) => e.kind === 'error');
    expect(errorEvent && 'message' in errorEvent ? errorEvent.message : '').toBe(
      'connection reset by peer',
    );
  });
});
