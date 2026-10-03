import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStoreModule,
  resetStorySpies,
  type StoryStore,
  type StoryStoreModule,
} from './storyHarness';
import type { SlotKey } from '@goodboy/core';
import type {
  ContextSlot,
  IsoDateTime,
  Session,
  SessionDecision,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  ProviderRunId,
  WorkspaceId,
} from '@goodboy/types';

let resolveSummarize: (() => void) | null = null;
type SummarizerUpsert = { readonly key: SlotKey; readonly value: string };
let summarizerUpserts: ReadonlyArray<SummarizerUpsert> = [];
let summarizerUpsertSequence: Array<ReadonlyArray<SummarizerUpsert>> = [];
let summarizerDecisionOps: ReadonlyArray<unknown> = [];
let summarizerConstructorCalls: Array<unknown> = [];
let summarizeInputCalls: Array<{ readonly turnInput: string; readonly turnOutput: string }> = [];
const summarizeSpy = vi.fn(
  () =>
    new Promise<void>((resolve) => {
      resolveSummarize = resolve;
    }),
);

vi.mock('@goodboy/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...original,
    Summarizer: class {
      constructor(deps: unknown) {
        summarizerConstructorCalls.push(deps);
      }

      summarize(input: { readonly turnInput: string; readonly turnOutput: string }) {
        summarizeInputCalls.push({ turnInput: input.turnInput, turnOutput: input.turnOutput });
        const upserts = summarizerUpsertSequence.shift() ?? summarizerUpserts;
        return summarizeSpy().then(() => ({
          delta: { upserts, decisionOps: summarizerDecisionOps },
          usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, estimatedCostUsd: 0 },
          model: 'claude-haiku-4-5',
        }));
      }
    },
  };
});

let dbSlots: ReadonlyArray<ContextSlot> = [];
let dbDecisions: ReadonlyArray<SessionDecision> = [];
let resolveTelemetryList: ((records: ReadonlyArray<TelemetryRecord>) => void) | null = null;
const listTelemetryForSessionSpy = vi.fn(async () => [] as ReadonlyArray<TelemetryRecord>);
const upsertContextSlotSpy = vi.fn(
  async (_database: unknown, _sessionId: SessionId, slot: ContextSlot, _author: string) => {
    dbSlots = [...dbSlots.filter((existing) => existing.key !== slot.key), slot];
  },
);

const insertSessionEventSpy = vi.fn(
  async (_params: { readonly event: { readonly kind: string; readonly payload: unknown } }) =>
    undefined,
);

vi.mock('@goodboy/db', async () =>
  (await import('./storyHarness')).dbModuleMock({
    insertSessionEvent: insertSessionEventSpy,
    listContextSlotsForSession: vi.fn(async () => dbSlots),
    listTelemetryForSession: listTelemetryForSessionSpy,
    upsertContextSlot: upsertContextSlotSpy,
    listSessionDecisions: vi.fn(async () => dbDecisions),
    saveSessionDecisions: vi.fn(
      async ({ decisions }: { readonly decisions: ReadonlyArray<SessionDecision> }) => {
        const touched = new Map(decisions.map((row) => [row.number, row]));
        const kept = dbDecisions.filter((row) => !touched.has(row.number));
        dbDecisions = [...kept, ...touched.values()].sort((a, b) => a.number - b.number);
      },
    ),
  }),
);

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const SESSION_ID = 'task-queue-test' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const NOW: IsoDateTime = '2026-05-10T00:00:00.000Z' as IsoDateTime;

function buildSession(): Session {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'test queue',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

let storeModule: StoryStoreModule;
let useAppStore: StoryStore;

beforeAll(async () => {
  storeModule = await importStoreModule();
  useAppStore = storeModule.useAppStore;
}, STORE_IMPORT_TIMEOUT_MS);

describe('summarizer queue, coalescing and no-stack', () => {
  beforeEach(() => {
    resetStorySpies();
    summarizeSpy.mockReset();
    resolveSummarize = null;
    summarizerUpserts = [];
    summarizerDecisionOps = [];
    dbDecisions = [];
    insertSessionEventSpy.mockClear();
    summarizerUpsertSequence = [];
    summarizerConstructorCalls = [];
    summarizeInputCalls = [];
    dbSlots = [];
    resolveTelemetryList = null;
    listTelemetryForSessionSpy.mockReset();
    listTelemetryForSessionSpy.mockResolvedValue([]);
    upsertContextSlotSpy.mockClear();
    summarizeSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rapid back-to-back triggers result in at most 2 underlying summarize calls', async () => {
    let firstResolve: () => void = () => undefined;
    summarizeSpy
      .mockImplementationOnce(
        () =>
          new Promise<void>((res) => {
            firstResolve = res;
          }),
      )
      .mockResolvedValue(undefined);

    const { summarizerQueues } = await import('./slices/turn/turnHelpers');
    summarizerQueues.clear();

    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: {},
      summarizerStatus: {},
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
          },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    const state = useAppStore.getState();
    const queue = {
      inFlight: true,
      scheduled: null,
      queued: [] as ReadonlyArray<{
        turnInput: string;
        turnOutput: string;
        workingDir: string | null;
        oversizeRetried: boolean;
      }>,
    };
    summarizerQueues.set(SESSION_ID, queue);

    for (let i = 1; i <= 4; i++) {
      if (queue.inFlight) {
        queue.queued = [
          ...queue.queued,
          {
            turnInput: `input-${i}`,
            turnOutput: `output-${i}`,
            workingDir: null,
            oversizeRetried: false,
          },
        ];
      }
    }

    expect(queue.queued).toHaveLength(4);
    expect(queue.queued.at(-1)?.turnInput).toBe('input-4');

    const callsBefore = summarizeSpy.mock.calls.length;
    firstResolve();
    await Promise.resolve();

    expect(callsBefore).toBeLessThanOrEqual(2);
    expect(state).toBeDefined();

    summarizerQueues.delete(SESSION_ID);
  });

  it('uses the configured summarizer task model when no override is provided', async () => {
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: [] },
      summarizerStatus: {},
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          defaultProviderId: null,
          defaultBranchPrefix: null,
          defaultVerbosity: null,
          providerBindings: null,
          taskModels: {
            summarizer: { providerId: 'cursor', model: 'sonnet-4.6' },
          },
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
        },
      },
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
          },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });

    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(summarizerConstructorCalls).toContainEqual(
      expect.objectContaining({ providerId: 'cursor', model: 'sonnet-4.6' }),
    );
    useAppStore.setState({ workspaceOverrides: {} });
  });

  it('drops the session queue once it drains', async () => {
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: [] },
      summarizerStatus: {},
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });
    expect(queues.get(SESSION_ID)?.inFlight).toBe(true);

    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(queues.size).toBe(0);
  });

  it('summarizes in the worktree the turn wrote to, not the first of the session', async () => {
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: [] },
      summarizerStatus: {},
      sessionWorktrees: { [SESSION_ID]: ['/repos/app/first', '/repos/app/second'] },
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: '/repos/app/second',
    });

    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(summarizerConstructorCalls).toContainEqual(
      expect.objectContaining({ workingDir: '/repos/app/second' }),
    );
    expect(summarizerConstructorCalls).not.toContainEqual(
      expect.objectContaining({ workingDir: '/repos/app/first' }),
    );
    useAppStore.setState({ sessionWorktrees: {} });
  });

  it('uses the current workspace provider instead of the captured session provider', async () => {
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: [] },
      summarizerStatus: {},
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          defaultProviderId: 'codex',
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
        },
      },
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });

    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(summarizerConstructorCalls).toContainEqual(
      expect.objectContaining({ providerId: 'codex', model: 'gpt-5.6-luna' }),
    );
    useAppStore.setState({ workspaceOverrides: {} });
  });

  it('preserves an explicit codex variant for session summaries', async () => {
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: [] },
      summarizerStatus: {},
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          defaultProviderId: 'codex',
          defaultBranchPrefix: null,
          defaultVerbosity: null,
          providerBindings: null,
          taskModels: {
            summarizer: { providerId: 'codex', model: 'gpt-5.6-terra', effort: 'high' },
          },
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
        },
      },
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });

    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(summarizerConstructorCalls).toContainEqual(
      expect.objectContaining({ providerId: 'codex', model: 'gpt-5.6-terra', effort: 'high' }),
    );
    useAppStore.setState({ workspaceOverrides: {} });
  });

  it('single trigger with nothing in-flight fires immediately and clears queue', async () => {
    let resolved = false;
    summarizeSpy.mockImplementation(async () => {
      resolved = true;
    });

    const { summarizerQueues: sq } = await import('./slices/turn/turnHelpers');
    sq.clear();

    const queue = {
      inFlight: false,
      scheduled: null,
      queued: [] as ReadonlyArray<{
        turnInput: string;
        turnOutput: string;
        workingDir: string | null;
        oversizeRetried: boolean;
      }>,
    };
    sq.set(SESSION_ID, queue);

    queue.inFlight = true;
    await summarizeSpy();
    queue.inFlight = false;

    expect(resolved).toBe(true);
    expect(queue.queued).toEqual([]);
    expect(queue.inFlight).toBe(false);

    sq.delete(SESSION_ID);
  });

  it('keeps telemetry recorded while the summarizer refresh is in flight', async () => {
    const staleRecord = {
      id: 'telemetry-old' as TelemetryRecordId,
      runId: 'run-old' as ProviderRunId,
      sessionId: SESSION_ID,
      kind: 'turn',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      inputTokens: 100,
      outputTokens: 10,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 0,
      estimatedCostUsd: 0.01,
      recordedAt: NOW,
    } satisfies TelemetryRecord;
    const currentRecord = {
      ...staleRecord,
      id: 'telemetry-current' as TelemetryRecordId,
      runId: 'run-current' as ProviderRunId,
      inputTokens: 200,
    } satisfies TelemetryRecord;
    listTelemetryForSessionSpy.mockImplementationOnce(
      () =>
        new Promise<ReadonlyArray<TelemetryRecord>>((resolve) => {
          resolveTelemetryList = resolve;
        }),
    );
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: [] },
      sessionTelemetry: { [SESSION_ID]: [staleRecord] },
      summarizerStatus: {},
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
          },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });
    await vi.waitFor(() => expect(listTelemetryForSessionSpy).toHaveBeenCalledTimes(1));
    useAppStore.setState({ sessionTelemetry: { [SESSION_ID]: [staleRecord, currentRecord] } });
    resolveTelemetryList?.([staleRecord]);

    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(useAppStore.getState().sessionTelemetry[SESSION_ID]).toEqual([
      staleRecord,
      currentRecord,
    ]);
  });

  it('in-flight + multiple queued accumulates every turn instead of dropping all but the last', async () => {
    const { summarizerQueues: sq, mergeQueuedSummarizerEntries } =
      await import('./slices/turn/turnHelpers');
    sq.clear();

    const queue = {
      inFlight: true,
      scheduled: null,
      queued: [] as ReadonlyArray<{
        turnInput: string;
        turnOutput: string;
        workingDir: string | null;
        oversizeRetried: boolean;
      }>,
    };
    sq.set(SESSION_ID, queue);

    for (let i = 0; i < 10; i++) {
      if (queue.inFlight) {
        queue.queued = [
          ...queue.queued,
          { turnInput: `t${i}`, turnOutput: `o${i}`, workingDir: null, oversizeRetried: false },
        ];
      }
    }

    expect(queue.queued).toHaveLength(10);

    const merged = mergeQueuedSummarizerEntries(queue.queued);
    expect(merged.turnInput).toContain('t0');
    expect(merged.turnInput).toContain('t9');
    expect(merged.turnOutput).toContain('o0');
    expect(merged.turnOutput).toContain('o9');

    sq.delete(SESSION_ID);
  });

  it('merges the queued turns into one pass instead of running one pass per turn', async () => {
    const { mergeQueuedSummarizerEntries } = await import('./slices/turn/turnHelpers');

    const merged = mergeQueuedSummarizerEntries([
      {
        turnInput: 'first input',
        turnOutput: 'first output',
        workingDir: null,
        oversizeRetried: false,
      },
      {
        turnInput: 'second input',
        turnOutput: 'second output',
        workingDir: null,
        oversizeRetried: false,
      },
    ]);

    expect(merged.turnInput).toBe('Turn 1:\nfirst input\n\n---\n\nTurn 2:\nsecond input');
    expect(merged.turnOutput).toBe('Turn 1:\nfirst output\n\n---\n\nTurn 2:\nsecond output');
  });

  it('drops the oldest turns behind a note once the merged text passes the budget', async () => {
    const { mergeQueuedSummarizerEntries } = await import('./slices/turn/turnHelpers');

    const big = 'x'.repeat(15_000);
    const merged = mergeQueuedSummarizerEntries([
      { turnInput: big, turnOutput: big, workingDir: null, oversizeRetried: false },
      { turnInput: big, turnOutput: big, workingDir: null, oversizeRetried: false },
      {
        turnInput: 'latest input',
        turnOutput: 'latest output',
        workingDir: null,
        oversizeRetried: false,
      },
    ]);

    expect(merged.turnInput).toContain('earlier turn');
    expect(merged.turnInput).toContain('latest input');
    expect(merged.turnInput).not.toContain(big);
  });

  it('waitForSummarizerSettled is not exported, summarizer never blocks user actions (#461)', async () => {
    expect((storeModule as Record<string, unknown>)['waitForSummarizerSettled']).toBeUndefined();
  });

  it('queue inFlight=true while summarizer runs does not prevent subsequent queue entries', async () => {
    const { summarizerQueues: sq } = await import('./slices/turn/turnHelpers');
    sq.clear();

    const queue = {
      inFlight: true,
      scheduled: null,
      queued: [] as ReadonlyArray<{
        turnInput: string;
        turnOutput: string;
        workingDir: string | null;
        oversizeRetried: boolean;
      }>,
    };
    sq.set(SESSION_ID, queue);

    queue.queued = [
      ...queue.queued,
      { turnInput: 'next-input', turnOutput: '', workingDir: null, oversizeRetried: false },
    ];

    expect(queue.queued.at(-1)?.turnInput).toBe('next-input');
    expect(queue.inFlight).toBe(true);

    sq.delete(SESSION_ID);
  });

  it('skips a conflicting slot write without blocking non-conflicting upserts', async () => {
    let resolveFirst: () => void = () => undefined;
    summarizeSpy
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    summarizerUpserts = [
      { key: 'goal', value: 'summarized goal' },
      { key: 'open_questions', value: '- summarized question' },
    ];
    dbSlots = [
      { key: 'goal', value: 'original goal', enabled: true },
      { key: 'open_questions', value: '- original question', enabled: true },
    ];
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: dbSlots },
      summarizerStatus: {},
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
          },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });
    await vi.waitFor(() => expect(summarizeSpy).toHaveBeenCalledTimes(1));

    const concurrentGoal: ContextSlot = {
      key: 'goal',
      value: 'concurrent user goal',
      enabled: true,
    };
    dbSlots = [
      concurrentGoal,
      { key: 'open_questions', value: '- original question', enabled: true },
    ];
    useAppStore.setState({ sessionSlots: { [SESSION_ID]: dbSlots } });
    summarizerUpserts = [];
    resolveFirst();

    await vi.waitFor(() => expect(summarizeSpy).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(upsertContextSlotSpy).toHaveBeenCalledTimes(1);
    expect(upsertContextSlotSpy.mock.calls[0]?.[2]).toMatchObject({
      key: 'open_questions',
      value: '- summarized question',
    });
    expect(useAppStore.getState().sessionSlots[SESSION_ID]).toContainEqual(concurrentGoal);
  });

  it('applies the decision operations and logs what really changed', async () => {
    summarizeSpy.mockResolvedValue(undefined);
    summarizerUpserts = [{ key: 'goal', value: 'same goal' }];
    summarizerDecisionOps = [
      { kind: 'add', text: 'new decision' },
      { kind: 'reword', number: 1, text: 'kept decision, reworded' },
    ];
    dbSlots = [
      { key: 'goal', value: 'same goal', enabled: true },
      { key: 'decisions', value: '- D1 kept decision', enabled: true },
    ];
    dbDecisions = [
      {
        id: 'd1',
        sessionId: SESSION_ID,
        number: 1,
        text: 'kept decision',
        why: null,
        status: 'active',
        replacedBy: null,
        author: 'agent',
        agentId: null,
        turnOrdinal: null,
        reason: null,
        closedBy: null,
        closedByAgentId: null,
        previousText: null,
        rewordedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: dbSlots },
      summarizerStatus: {},
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
          },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });
    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));

    const decisionEvents = insertSessionEventSpy.mock.calls
      .map(([params]) => params.event)
      .filter((event) => event.kind === 'decisions_changed');
    expect(decisionEvents).toHaveLength(1);
    expect(decisionEvents[0]?.payload).toMatchObject({
      added: 1,
      replaced: 0,
      withdrawn: 0,
      merged: 0,
      decisionChanges: [{ kind: 'added', number: 2, text: 'new decision' }],
    });
    expect(dbSlots.find((slot) => slot.key === 'decisions')?.value).toBe(
      '- D2 new decision\n- D1 kept decision, reworded',
    );
  });

  it('coalesces multiple conflicts into one follow-up pass', async () => {
    let resolveFirst: () => void = () => undefined;
    summarizeSpy
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    summarizerUpserts = [
      { key: 'goal', value: 'summarized goal' },
      { key: 'open_questions', value: '- summarized question' },
    ];
    dbSlots = [
      { key: 'goal', value: 'original goal', enabled: true },
      { key: 'open_questions', value: '- original question', enabled: true },
    ];
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: dbSlots },
      summarizerStatus: {},
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
          },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });
    await vi.waitFor(() => expect(summarizeSpy).toHaveBeenCalledTimes(1));
    dbSlots = [
      { key: 'goal', value: 'concurrent goal', enabled: true },
      { key: 'open_questions', value: '- concurrent question', enabled: true },
    ];
    useAppStore.setState({ sessionSlots: { [SESSION_ID]: dbSlots } });
    summarizerUpserts = [];
    resolveFirst();

    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(summarizeSpy).toHaveBeenCalledTimes(2);
    expect(upsertContextSlotSpy).not.toHaveBeenCalled();
  });

  it('reads every turn that finished while a pass was in flight, not only the last one', async () => {
    let resolveFirst: () => void = () => undefined;
    summarizeSpy
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: [] },
      summarizerStatus: {},
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'first agent turn',
      turnOutput: 'first agent output',
      workingDir: null,
    });
    await vi.waitFor(() => expect(summarizeSpy).toHaveBeenCalledTimes(1));

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'second agent turn',
      turnOutput: 'second agent output',
      workingDir: null,
    });
    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'third agent turn',
      turnOutput: 'third agent output',
      workingDir: null,
    });
    resolveFirst();

    await vi.waitFor(() => expect(summarizeSpy).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));

    const followUp = summarizeInputCalls[1];
    expect(followUp?.turnInput).toContain('second agent turn');
    expect(followUp?.turnInput).toContain('third agent turn');
    expect(followUp?.turnOutput).toContain('second agent output');
    expect(followUp?.turnOutput).toContain('third agent output');
  });

  it('re-enqueues only once when every pass changes an oversize slot', async () => {
    summarizerUpsertSequence = Array.from({ length: 10 }, (_, index) => [
      { key: 'goal', value: `${index}${'x'.repeat(561)}` },
    ]);
    dbSlots = [{ key: 'goal', value: 'original goal', enabled: true }];
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: dbSlots },
      summarizerStatus: {},
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
          },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });

    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(summarizeSpy).toHaveBeenCalledTimes(2);
    expect(upsertContextSlotSpy).toHaveBeenCalledTimes(2);
  });

  it('does not re-enqueue for an unchanged slot above twice its budget', async () => {
    const oversizeGoal = 'x'.repeat(561);
    summarizerUpserts = [{ key: 'goal', value: oversizeGoal }];
    dbSlots = [{ key: 'goal', value: oversizeGoal, enabled: true }];
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: dbSlots },
      summarizerStatus: {},
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
          },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'turn input',
      turnOutput: 'turn output',
      workingDir: null,
    });

    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));
    expect(summarizeSpy).toHaveBeenCalledTimes(1);
    expect(upsertContextSlotSpy).toHaveBeenCalledTimes(1);
  });

  it('queues Update now behind the pass in flight and records what each round did', async () => {
    let resolveFirst: () => void = () => undefined;
    summarizeSpy
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    summarizerUpsertSequence = [
      [{ key: 'last_output_summary', value: 'first summary' }],
      [{ key: 'goal', value: 'ship the queue' }],
      [],
    ];
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: [] },
      summarizerStatus: {},
      summarizerRounds: {},
      summarizerPending: {},
    });
    const turn = (label: string) =>
      enqueueSummarizer({
        set: useAppStore.setState,
        get: useAppStore.getState,
        sessionId: SESSION_ID,
        turnInput: `${label} turn`,
        turnOutput: `${label} output`,
        workingDir: null,
      });

    turn('first');
    await vi.waitFor(() => expect(summarizeSpy).toHaveBeenCalledTimes(1));
    turn('second');
    turn('third');
    useAppStore.getState().requestContextUpdate(SESSION_ID);

    expect(useAppStore.getState().summarizerPending[SESSION_ID]).toEqual({
      turns: 2,
      isUpdateQueued: true,
    });
    expect(summarizeSpy).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().summarizerRounds[SESSION_ID]).toBeUndefined();

    resolveFirst();
    await vi.waitFor(() => expect(summarizeSpy).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));

    expect(summarizeInputCalls[1]?.turnInput).toContain('third turn');
    expect(summarizeInputCalls[2]).toEqual({ turnInput: '', turnOutput: '' });
    expect(useAppStore.getState().summarizerRounds[SESSION_ID]).toMatchObject({
      mode: 'consolidate',
      turns: 0,
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      changed: { goal: false, decisions: 0, summary: false },
    });
    expect(useAppStore.getState().summarizerPending[SESSION_ID]).toEqual({
      turns: 0,
      isUpdateQueued: false,
    });
  });

  it('counts the turns a merged pass read and the slots it changed', async () => {
    let resolveFirst: () => void = () => undefined;
    let resolveSecond: () => void = () => undefined;
    summarizeSpy
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSecond = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    summarizerUpsertSequence = [[], [{ key: 'goal', value: 'ship the queue' }]];
    const { enqueueSummarizer, summarizerQueues: queues } =
      await import('./slices/turn/turnHelpers');
    queues.clear();
    useAppStore.setState({
      sessions: [buildSession()],
      sessionSlots: { [SESSION_ID]: [] },
      summarizerStatus: {},
      summarizerRounds: {},
      summarizerPending: {},
    });
    const turn = (label: string) =>
      enqueueSummarizer({
        set: useAppStore.setState,
        get: useAppStore.getState,
        sessionId: SESSION_ID,
        turnInput: `${label} turn`,
        turnOutput: `${label} output`,
        workingDir: null,
      });

    turn('first');
    await vi.waitFor(() => expect(summarizeSpy).toHaveBeenCalledTimes(1));
    turn('second');
    turn('third');
    turn('fourth');
    resolveFirst();
    await vi.waitFor(() => expect(summarizeSpy).toHaveBeenCalledTimes(2));
    expect(useAppStore.getState().summarizerRounds[SESSION_ID]).toMatchObject({
      mode: 'turn',
      turns: 1,
    });
    resolveSecond();
    await vi.waitFor(() => expect(queues.has(SESSION_ID)).toBe(false));

    expect(useAppStore.getState().summarizerRounds[SESSION_ID]).toMatchObject({
      mode: 'turn',
      turns: 3,
      changed: { goal: true, decisions: 0, summary: false },
    });
  });
});
