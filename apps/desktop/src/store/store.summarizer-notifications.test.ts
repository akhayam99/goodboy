import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type { IsoDateTime, ProviderId, SessionId, WorkspaceId } from '@goodboy/types';
import { overridesWithAttribution } from '../__tests__/helpers/attributionOverrides';

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

const summarizeSpy = vi.fn();

const summarizerRoutes: Array<{ providerId: string; model: string }> = [];

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...actual,
    Summarizer: class {
      constructor(opts: { providerId: string; model: string }) {
        summarizerRoutes.push({ providerId: opts.providerId, model: opts.model });
      }
      summarize() {
        return summarizeSpy();
      }
    },
  };
});

const insertNotificationSpy = storySpies.insertNotification;

const logWarn = console.warn;
const SUMMARIZER_FAILURE_PREFIX = '[summarizer] failed for session ';
let summarizerFailureLogs: string[] = [];

const captureSummarizerFailures = () => {
  summarizerFailureLogs = [];
  vi.spyOn(console, 'warn').mockImplementation((...args: ReadonlyArray<unknown>) => {
    const line = String(args[0]);
    if (line.startsWith(SUMMARIZER_FAILURE_PREFIX)) {
      summarizerFailureLogs.push(line.slice(line.indexOf(': ') + 2));
      return;
    }
    logWarn(...args);
  });
};

const expectLoggedEveryRejection = () => {
  const rejected = summarizeSpy.mock.settledResults.flatMap((result) =>
    result.type === 'rejected' && result.value instanceof Error ? [result.value.message] : [],
  );
  expect(summarizerFailureLogs).toEqual(rejected);
  vi.restoreAllMocks();
};

const SESSION_ID = 'session-notif-test' as SessionId;
const WORKSPACE_ID = 'ws-notif-test' as WorkspaceId;
const NOW = '2026-07-23T00:00:00.000Z' as IsoDateTime;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('summarizer notifications', () => {
  beforeEach(() => {
    resetStorySpies();
    vi.clearAllMocks();
    captureSummarizerFailures();
  });

  afterEach(() => {
    expectLoggedEveryRejection();
    vi.clearAllMocks();
  });

  it('a successful summary notifies nobody', async () => {
    summarizeSpy.mockResolvedValue({
      delta: { upserts: [], decisionOps: [] },
      usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0, estimatedCostUsd: 0 },
      model: 'claude-haiku-4-5',
    });
    const { enqueueSummarizer, summarizerQueues } = await import('./turn-helpers');

    summarizerQueues.delete(SESSION_ID);
    useAppStore.setState({
      sessions: [
        {
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: 'test',
          state: { kind: 'idle', lastActivityAt: NOW },
          contextSlots: [],
          providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
          permissionMode: 'bypassPermissions' as const,
          autoRun: false,
          titleUserEdited: false,
          workflowRuns: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
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

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'user input',
      turnOutput: 'agent output',
      workingDir: null,
    });

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('idle'),
      { timeout: 5000 },
    );

    expect(insertNotificationSpy).not.toHaveBeenCalled();
  });

  it('failure notification body includes provider and error, carries retry action', async () => {
    summarizeSpy.mockRejectedValue(new Error('model overloaded'));
    const { enqueueSummarizer, summarizerQueues } = await import('./turn-helpers');

    summarizerQueues.delete(SESSION_ID);
    useAppStore.setState({
      sessions: [
        {
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: 'test',
          state: { kind: 'idle', lastActivityAt: NOW },
          contextSlots: [],
          providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
          permissionMode: 'bypassPermissions' as const,
          autoRun: false,
          titleUserEdited: false,
          workflowRuns: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
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

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'user input',
      turnOutput: 'agent output',
      workingDir: null,
    });

    await vi.waitFor(() => expect(insertNotificationSpy).toHaveBeenCalled(), { timeout: 5000 });

    type NotifCall = [unknown, Record<string, unknown>];
    const calls = insertNotificationSpy.mock.calls as unknown as NotifCall[];
    const call = calls.find((c) => c[1].severity === 'error');
    expect(call).not.toBeUndefined();
    const n = call?.[1] ?? {};
    expect(n.body as string).toContain('anthropic');
    expect(n.body as string).toContain('model overloaded');
    expect(n.action).toEqual({ kind: 'retry-summarizer', sessionId: SESSION_ID });
  });

  it('retries a parse failure exactly once before surfacing it', async () => {
    const { SummarizerParseError } = await import('@goodboy/core');
    summarizeSpy.mockRejectedValue(new SummarizerParseError('not valid JSON', 'Sistema bloccato'));
    const { enqueueSummarizer, summarizerQueues } = await import('./turn-helpers');

    summarizerQueues.delete(SESSION_ID);
    useAppStore.setState({
      sessions: [
        {
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: 'test',
          state: { kind: 'idle', lastActivityAt: NOW },
          contextSlots: [],
          providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
          permissionMode: 'bypassPermissions' as const,
          autoRun: false,
          titleUserEdited: false,
          workflowRuns: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
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

    enqueueSummarizer({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      turnInput: 'user input',
      turnOutput: 'agent output',
      workingDir: null,
    });

    await vi.waitFor(() => expect(insertNotificationSpy).toHaveBeenCalled(), { timeout: 5000 });

    expect(summarizeSpy).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('error');
  });
});

type SeedParams = {
  readonly connected: ReadonlyArray<ProviderId>;
  readonly cooldowns?: Readonly<Partial<Record<ProviderId, number>>>;
};

const seedSummarizerState = async ({ connected, cooldowns }: SeedParams) => {
  const { PROVIDER_CAPABILITIES } = await import('@goodboy/core');
  useAppStore.setState({
    sessions: [
      {
        id: SESSION_ID,
        workspaceId: WORKSPACE_ID,
        goal: 'test',
        state: { kind: 'idle', lastActivityAt: NOW },
        contextSlots: [],
        providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
        permissionMode: 'bypassPermissions' as const,
        autoRun: false,
        titleUserEdited: false,
        workflowRuns: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    sessionSlots: {},
    summarizerStatus: {},
    providerCooldowns: cooldowns ?? {},
    providers: connected.map((id) => ({
      id,
      label: id,
      binary: id,
      docsUrl: '',
      capabilities: PROVIDER_CAPABILITIES[id],
      connection: 'connected' as const,
      version: null,
      identity: null,
      error: null,
    })),
    workspaces: [
      {
        id: WORKSPACE_ID,
        name: 'ws',
        slug: 'ws',
        overrides: overridesWithAttribution({ attributionFooter: null }),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  });
  return useAppStore;
};

const enqueue = async () => {
  const { enqueueSummarizer, summarizerQueues } = await import('./turn-helpers');
  summarizerQueues.delete(SESSION_ID);
  enqueueSummarizer({
    set: useAppStore.setState,
    get: useAppStore.getState,
    sessionId: SESSION_ID,
    turnInput: 'user input',
    turnOutput: 'agent output',
    workingDir: null,
  });
};

const coalesceKeys = (): ReadonlyArray<string | null | undefined> =>
  (insertNotificationSpy.mock.calls as unknown as ReadonlyArray<ReadonlyArray<unknown>>).map(
    (args) => (args[1] as { coalesceKey?: string | null } | undefined)?.coalesceKey,
  );

describe('summarizer provider fallback', () => {
  beforeEach(() => {
    resetStorySpies();
    vi.clearAllMocks();
    summarizerRoutes.length = 0;
    captureSummarizerFailures();
  });

  afterEach(() => {
    expectLoggedEveryRejection();
    vi.clearAllMocks();
  });

  it('moves to another provider when the first one is out of tokens', async () => {
    summarizeSpy.mockRejectedValueOnce(new Error('Claude usage limit reached')).mockResolvedValue({
      delta: { upserts: [], decisionOps: [] },
      usage: { inputTokens: 4, outputTokens: 2, cachedInputTokens: 0, estimatedCostUsd: 0 },
      model: 'gpt-5.6-terra',
    });

    const useAppStore = await seedSummarizerState({ connected: ['anthropic', 'codex'] });
    await enqueue();

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('idle'),
      { timeout: 5000 },
    );

    expect(summarizerRoutes.map((route) => route.providerId)).toEqual(['anthropic', 'codex']);
    expect(insertNotificationSpy).not.toHaveBeenCalled();
  });

  it('records a cooldown for the provider that ran out', async () => {
    summarizeSpy.mockRejectedValueOnce(new Error('Claude usage limit reached')).mockResolvedValue({
      delta: { upserts: [], decisionOps: [] },
      usage: { inputTokens: 4, outputTokens: 2, cachedInputTokens: 0, estimatedCostUsd: 0 },
      model: 'gpt-5.6-terra',
    });

    const useAppStore = await seedSummarizerState({ connected: ['anthropic', 'codex'] });
    await enqueue();

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('idle'),
      { timeout: 5000 },
    );

    expect(useAppStore.getState().providerCooldowns.anthropic).toBeGreaterThan(Date.now());
  });

  it('moves to another provider on an authentication failure', async () => {
    summarizeSpy.mockRejectedValueOnce(new Error('401 unauthorized')).mockResolvedValue({
      delta: { upserts: [], decisionOps: [] },
      usage: { inputTokens: 4, outputTokens: 2, cachedInputTokens: 0, estimatedCostUsd: 0 },
      model: 'gpt-5.6-terra',
    });

    const useAppStore = await seedSummarizerState({ connected: ['anthropic', 'codex'] });
    await enqueue();

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('idle'),
      { timeout: 5000 },
    );

    expect(summarizerRoutes.map((route) => route.providerId)).toEqual(['anthropic', 'codex']);
  });

  it('records a cooldown for a provider that is unauthenticated', async () => {
    summarizeSpy.mockRejectedValueOnce(new Error('401 unauthorized')).mockResolvedValue({
      delta: { upserts: [], decisionOps: [] },
      usage: { inputTokens: 4, outputTokens: 2, cachedInputTokens: 0, estimatedCostUsd: 0 },
      model: 'gpt-5.6-terra',
    });

    const useAppStore = await seedSummarizerState({ connected: ['anthropic', 'codex'] });
    await enqueue();

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('idle'),
      { timeout: 5000 },
    );

    expect(useAppStore.getState().providerCooldowns.anthropic).toBeGreaterThan(Date.now());
  });

  it('records a cooldown for a provider that is rate limited', async () => {
    summarizeSpy.mockRejectedValueOnce(new Error('429 too many requests')).mockResolvedValue({
      delta: { upserts: [], decisionOps: [] },
      usage: { inputTokens: 4, outputTokens: 2, cachedInputTokens: 0, estimatedCostUsd: 0 },
      model: 'gpt-5.6-terra',
    });

    const useAppStore = await seedSummarizerState({ connected: ['anthropic', 'codex'] });
    await enqueue();

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('idle'),
      { timeout: 5000 },
    );

    expect(useAppStore.getState().providerCooldowns.anthropic).toBeGreaterThan(Date.now());
  });

  it('stops at one provider switch and notifies once', async () => {
    summarizeSpy.mockRejectedValue(new Error('Claude usage limit reached'));

    const useAppStore = await seedSummarizerState({ connected: ['anthropic', 'codex', 'gemini'] });
    await enqueue();

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('error'),
      { timeout: 5000 },
    );

    expect(summarizeSpy).toHaveBeenCalledTimes(2);
    expect(insertNotificationSpy).toHaveBeenCalledTimes(1);
  });

  it('skips a cooling-down provider on the next enqueue', async () => {
    summarizeSpy.mockResolvedValue({
      delta: { upserts: [], decisionOps: [] },
      usage: { inputTokens: 4, outputTokens: 2, cachedInputTokens: 0, estimatedCostUsd: 0 },
      model: 'gpt-5.6-terra',
    });

    const useAppStore = await seedSummarizerState({
      connected: ['anthropic', 'codex'],
      cooldowns: { anthropic: Date.now() + 600_000 },
    });
    await enqueue();

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('idle'),
      { timeout: 5000 },
    );

    expect(summarizerRoutes.map((route) => route.providerId)).toEqual(['codex']);
  });

  it('stops spawning and says so when no provider is left', async () => {
    summarizeSpy.mockRejectedValue(new Error('Claude usage limit reached'));

    const useAppStore = await seedSummarizerState({ connected: ['anthropic'] });
    await enqueue();

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('error'),
      { timeout: 5000 },
    );

    await enqueue();
    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.error).toContain('cooling'),
      { timeout: 5000 },
    );

    expect(summarizeSpy).toHaveBeenCalledTimes(1);
    expect(coalesceKeys()).toEqual([
      `summarizer-failed:${SESSION_ID}`,
      expect.stringContaining(`summarizer-cooling:${SESSION_ID}:`),
    ]);
  });

  it('does not write providerCooldowns for a non-cooldown failure kind', async () => {
    summarizeSpy.mockRejectedValue(new Error('the model produced nonsense'));

    const useAppStore = await seedSummarizerState({ connected: ['anthropic'] });
    const setStateSpy = vi.spyOn(useAppStore, 'setState');
    await enqueue();

    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.status).toBe('error'),
      { timeout: 5000 },
    );

    const cooldownWrites = setStateSpy.mock.calls.filter((call) => {
      const updater = call[0];
      const patch = typeof updater === 'function' ? updater(useAppStore.getState()) : updater;
      return patch != null && 'providerCooldowns' in patch;
    });
    expect(cooldownWrites).toHaveLength(0);
    expect(useAppStore.getState().providerCooldowns).toEqual({});
  });

  it('reuses one coalesce key while the same cooldown window holds', async () => {
    summarizeSpy.mockRejectedValue(new Error('Claude usage limit reached'));

    const useAppStore = await seedSummarizerState({
      connected: ['anthropic'],
      cooldowns: { anthropic: Date.now() + 600_000 },
    });
    await enqueue();
    await vi.waitFor(
      () => expect(useAppStore.getState().summarizerStatus[SESSION_ID]?.error).toContain('cooling'),
      { timeout: 5000 },
    );
    await enqueue();
    await vi.waitFor(() => expect(insertNotificationSpy).toHaveBeenCalledTimes(2), {
      timeout: 5000,
    });

    expect(summarizeSpy).not.toHaveBeenCalled();
    const keys = coalesceKeys();
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toContain(`summarizer-cooling:${SESSION_ID}:`);
  });
});
