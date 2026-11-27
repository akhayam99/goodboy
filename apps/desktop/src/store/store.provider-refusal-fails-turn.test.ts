import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { TEST_NOW, aSession } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../features/providers/providers';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryAgent,
  buildStoryWorkspace,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';

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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const ACCOUNT = 'dev@northwind.test';
const AGENT_ID = brandId<AgentId>({ value: 'agent-implementer-northwind' });
const session = aSession();
const workspace = buildStoryWorkspace({ id: session.workspaceId, name: 'northwind', slug: 'nw' });

const codex: ProviderDisplayInfo = {
  id: 'codex',
  label: 'Codex',
  binary: 'codex',
  connection: 'connected',
  version: '0.162.1',
  identity: ACCOUNT,
  error: null,
  docsUrl: '',
  capabilities: { models: [] },
};

type RunArgs = {
  readonly runId: ProviderRunId;
  readonly model: string;
};

type StreamParams = {
  readonly args: RunArgs;
  readonly message: string;
};

const refusedThenCleanExit = async function* ({
  args,
  message,
}: StreamParams): AsyncIterable<TurnEvent> {
  yield {
    kind: 'provider_session_init',
    runId: args.runId,
    providerSessionId: 'thread-1',
    at: TEST_NOW,
  };
  yield { kind: 'error', runId: args.runId, message, at: TEST_NOW };
  yield { kind: 'done', runId: args.runId, at: TEST_NOW };
};

const answer = async function* ({ args }: Pick<StreamParams, 'args'>): AsyncIterable<TurnEvent> {
  yield { kind: 'assistant_text', runId: args.runId, delta: 'done', at: TEST_NOW };
  yield { kind: 'done', runId: args.runId, at: TEST_NOW };
};

type ChatGptParams = {
  readonly model: string;
};

const chatGptRefusal = ({ model }: ChatGptParams): string =>
  `{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The '${model}' model is not supported when using Codex with a ChatGPT account."}}`;

type ValueParams = {
  readonly value: unknown;
};

const runArgsOf = ({ value }: ValueParams): RunArgs => {
  const runId: unknown = Reflect.get(Object(value), 'runId');
  const model: unknown = Reflect.get(Object(value), 'model');
  if (typeof runId !== 'string' || typeof model !== 'string') {
    throw new Error('runTurn got no run args');
  }
  return { runId: brandId<ProviderRunId>({ value: runId }), model };
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('a provider that refuses the model in its stream and then exits cleanly', () => {
  beforeEach(async () => {
    resetStorySpies();
    const routing = await import('../features/providers/routing');
    vi.mocked(routing.resolveProviderForTurn).mockResolvedValue({
      selectedProvider: 'codex',
      selectedModel: 'gpt-6.1-sol',
      reason: 'preferred',
      fallbackUsed: false,
    });
    useAppStore.setState({
      sessions: [session],
      projects: [],
      sessionPhaseRuns: {
        [session.id]: [buildStoryAgent({ id: AGENT_ID, sessionId: session.id, name: 'Builder' })],
      },
      selectedAgentId: { [session.id]: AGENT_ID },
      transcripts: {},
      notifications: [],
      workspaces: [workspace],
      providers: [codex],
      authResults: { codex: { state: 'connected', identity: ACCOUNT } },
      unavailableModels: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fails the turn, names the cause and remembers the model for this account', async () => {
    storySpies.runTurn.mockImplementation((value: unknown) => {
      const args = runArgsOf({ value });
      return refusedThenCleanExit({ args, message: chatGptRefusal({ model: args.model }) });
    });
    const onSettled = vi.fn();

    await expect(
      useAppStore.getState().sendTurn({
        sessionId: session.id,
        agentId: AGENT_ID,
        content: 'fix the ledger',
        onSettled,
      }),
    ).rejects.toThrow(/not supported when using Codex with a ChatGPT account/);

    expect(onSettled).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasFailed: true, failureReason: 'model_not_available' }),
    );
    const db = await import('@goodboy/db');
    const statuses = vi
      .mocked(db.updateProviderRunStatus)
      .mock.calls.map(([, , status]) => status.kind);
    expect(statuses).not.toContain('succeeded');
    expect(statuses).toContain('failed');
    await vi.waitFor(() =>
      expect(useAppStore.getState().unavailableModels).toContainEqual(
        expect.objectContaining({
          providerId: 'codex',
          accountId: ACCOUNT,
          modelKey: 'gpt-6.1-sol',
          source: 'refused',
        }),
      ),
    );
    const errors = (useAppStore.getState().transcripts[AGENT_ID] ?? []).filter(
      (event) => event.kind === 'error',
    );
    expect(errors).toHaveLength(storySpies.runTurn.mock.calls.length);
    expect(errors.at(-1)).toMatchObject({ kind: 'error', retryable: true });
  });

  it('fails the turn on a sign-in refusal with the cause named', async () => {
    storySpies.runTurn.mockImplementation((value: unknown) =>
      refusedThenCleanExit({ args: runArgsOf({ value }), message: 'Error: 401 Unauthorized' }),
    );
    const onSettled = vi.fn();

    await expect(
      useAppStore.getState().sendTurn({
        sessionId: session.id,
        agentId: AGENT_ID,
        content: 'fix the ledger',
        onSettled,
      }),
    ).rejects.toThrow();

    expect(onSettled).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasFailed: true, failureReason: 'authentication' }),
    );
  });

  it('falls back to another model the account has', async () => {
    storySpies.runTurn.mockImplementation((value: unknown) => {
      const args = runArgsOf({ value });
      return args.model === 'gpt-6.1-sol'
        ? refusedThenCleanExit({ args, message: chatGptRefusal({ model: args.model }) })
        : answer({ args });
    });
    const onSettled = vi.fn();

    await useAppStore
      .getState()
      .sendTurn({ sessionId: session.id, agentId: AGENT_ID, content: 'fix the ledger', onSettled });

    const models = storySpies.runTurn.mock.calls.map(([value]) => runArgsOf({ value }).model);
    expect(models[0]).toBe('gpt-6.1-sol');
    expect(models[1]).not.toBe('gpt-6.1-sol');
    expect(onSettled).toHaveBeenLastCalledWith(expect.objectContaining({ hasFailed: false }));
  });

  it('forgets the model once the provider answers on it again', async () => {
    useAppStore.setState({
      unavailableModels: [
        {
          providerId: 'codex',
          accountId: ACCOUNT,
          modelKey: 'gpt-6.1-sol',
          plan: null,
          source: 'refused',
          checkedAt: Date.now(),
        },
      ],
    });
    storySpies.runTurn.mockImplementation((value: unknown) =>
      answer({ args: runArgsOf({ value }) }),
    );

    await useAppStore
      .getState()
      .sendTurn({ sessionId: session.id, agentId: AGENT_ID, content: 'fix the ledger' });

    await vi.waitFor(() => expect(useAppStore.getState().unavailableModels).toEqual([]));
  });
});
