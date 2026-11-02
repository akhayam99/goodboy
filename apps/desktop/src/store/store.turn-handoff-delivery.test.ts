import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { TEST_NOW, anAgent, nextProviderRunId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import { seedSessionWithMounts } from '../__tests__/helpers/seedSessionWithMounts';
import { CommandError } from '../shared/lib/invokeCommand';
import { lookupDeliveryRun } from '../features/chat/turn';

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

const runTurnSpy = storySpies.runTurn;

type RunParams = {
  readonly runId: ProviderRunId;
};

type SpawnArgs = {
  readonly deliveryId?: string;
  readonly prompt?: string;
};

type Seed = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type ProviderParams = {
  readonly provider: 'anthropic' | 'codex';
};

let useAppStore: StoryStore;

const answer = async function* ({ runId }: RunParams): AsyncIterable<TurnEvent> {
  yield { kind: 'assistant_text', runId, delta: 'Reconciled.', at: TEST_NOW };
};

const refusedAsDuplicate = async function* (): AsyncIterable<TurnEvent> {
  throw new CommandError({
    kind: 'delivery_duplicate',
    message: 'this delivery already started run run-first',
  });
};

const setupSession = (): Seed => {
  const sessionId = seedSessionWithMounts({ useAppStore });
  const agent = useAppStore.getState().sessionPhaseRuns[sessionId]?.[0] ?? anAgent({ sessionId });
  useAppStore.setState({
    sessionPhaseRuns: { [sessionId]: [agent] },
    selectedAgentId: { [sessionId]: agent.id },
    transcripts: {},
  });
  return { sessionId, agentId: agent.id };
};

const routeTo = async ({ provider }: ProviderParams): Promise<void> => {
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: provider,
    selectedModel: provider === 'codex' ? 'gpt-5.6-sol' : 'claude-3-5-sonnet-latest',
    reason: 'preferred',
    fallbackUsed: false,
  });
};

const stringField = (value: unknown, key: string): string | undefined => {
  const field: unknown =
    typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  return typeof field === 'string' ? field : undefined;
};

const spawnArgsOf = (value: unknown): SpawnArgs => {
  const deliveryId = stringField(value, 'deliveryId');
  const prompt = stringField(value, 'prompt');
  return {
    ...(deliveryId === undefined ? {} : { deliveryId }),
    ...(prompt === undefined ? {} : { prompt }),
  };
};

const spawnCalls = (): ReadonlyArray<SpawnArgs> =>
  runTurnSpy.mock.calls.map((call) => spawnArgsOf(call[0]));

const transcriptOf = ({ agentId }: { readonly agentId: AgentId }): ReadonlyArray<TurnEvent> =>
  useAppStore.getState().transcripts[agentId] ?? [];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  resetStorySpies();
  vi.mocked(lookupDeliveryRun).mockResolvedValue(null);
  runTurnSpy.mockImplementation((args: RunParams) => answer({ runId: args.runId }));
  await routeTo({ provider: 'anthropic' });
});

describe('a hand-sent turn and its delivery id', () => {
  it('passes a client delivery id to the spawn when the caller gave none', async () => {
    const { sessionId } = setupSession();

    await useAppStore.getState().sendTurn({ sessionId, content: 'hello' });

    expect(spawnCalls()).toHaveLength(1);
    expect(spawnCalls()[0]?.deliveryId).toMatch(/^hand:/);
  });

  it('keeps the id the caller gave and does not start a second run for it', async () => {
    const { sessionId, agentId } = setupSession();

    const first = await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'hello',
      origin: 'operator',
      deliveryId: 'queue:1',
    });
    vi.mocked(lookupDeliveryRun).mockResolvedValue({ runId: 'run-first', isLive: false });
    const second = await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'hello',
      origin: 'operator',
      deliveryId: 'queue:1',
    });

    expect(first.isAlreadySent).toBeUndefined();
    expect(second).toEqual({ blockedOverBudget: false, isAlreadySent: true });
    expect(spawnCalls()).toHaveLength(1);
    expect(spawnCalls()[0]?.deliveryId).toBe('queue:1');
    const userTexts = transcriptOf({ agentId }).filter((event) => event.kind === 'user_text');
    expect(userTexts).toHaveLength(1);
  });

  it('answers already sent to a second send that arrives while the first is in flight', async () => {
    const { sessionId, agentId } = setupSession();
    const gate = { open: (): void => undefined };
    const opened = new Promise<void>((resolve) => {
      gate.open = resolve;
    });
    runTurnSpy.mockImplementation(async function* (args: RunParams): AsyncIterable<TurnEvent> {
      await opened;
      yield* answer({ runId: args.runId });
    });

    const first = useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'hello',
      origin: 'operator',
      deliveryId: 'queue:2',
    });
    const second = await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'hello',
      origin: 'operator',
      deliveryId: 'queue:2',
    });
    gate.open();
    await first;

    expect(second.isAlreadySent).toBe(true);
    expect(spawnCalls()).toHaveLength(1);
  });

  it('gives the retry after a failure a new delivery id, and no id twice', async () => {
    const { sessionId, agentId } = setupSession();
    runTurnSpy.mockImplementation(async function* (args: RunParams): AsyncIterable<TurnEvent> {
      yield { kind: 'error', runId: args.runId, message: 'connection reset by peer', at: TEST_NOW };
    });

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'again',
      origin: 'operator',
      deliveryId: 'queue:3',
    });
    await useAppStore.getState().sendTurn({ sessionId, agentId, content: 'again' });

    const ids = spawnCalls().map((call) => call.deliveryId);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows already sent and starts no fallback run when the backend refuses the id', async () => {
    const { sessionId, agentId } = setupSession();
    runTurnSpy.mockImplementation(() => refusedAsDuplicate());

    await useAppStore
      .getState()
      .sendTurn({ sessionId, agentId, content: 'hello', origin: 'operator', deliveryId: 'queue:4' })
      .catch(() => undefined);

    expect(spawnCalls()).toHaveLength(1);
    const errors = transcriptOf({ agentId }).filter((event) => event.kind === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: 'This message was already sent.',
      retryable: false,
    });
  });
});

describe('a turn moved to another model', () => {
  const LONG = 'x'.repeat(4000);

  const seedLongHistory = ({ sessionId, agentId }: Seed): ProviderRunId => {
    const previousRunId = nextProviderRunId();
    const events: TurnEvent[] = [
      {
        kind: 'user_text',
        runId: previousRunId,
        text: 'Reconcile the Harborline export',
        at: TEST_NOW,
      },
      ...Array.from({ length: 6 }, (_, index): TurnEvent => ({
        kind: 'assistant_text',
        runId: previousRunId,
        delta: `step-${index}-${LONG}`,
        at: TEST_NOW,
      })),
      { kind: 'user_text', runId: previousRunId, text: `big paste ${LONG}`, at: TEST_NOW },
      { kind: 'assistant_text', runId: previousRunId, delta: `reply ${LONG}`, at: TEST_NOW },
    ];
    useAppStore.setState({
      transcripts: { [agentId]: events },
      agentRunHistory: { [agentId]: [previousRunId] },
      runRouting: {
        [agentId]: { [previousRunId]: { provider: 'anthropic', model: 'claude', effort: null } },
      },
      sessionPhaseRuns: {
        [sessionId]: [anAgent({ id: agentId, sessionId, providerSessionId: 'thread-1' })],
      },
    });
    return previousRunId;
  };

  it('always carries the original request and says what it left out', async () => {
    const seed = setupSession();
    seedLongHistory(seed);
    await routeTo({ provider: 'codex' });

    await useAppStore.getState().sendTurn({ sessionId: seed.sessionId, content: 'continue' });

    const prompt = spawnCalls()[0]?.prompt ?? '';
    expect(prompt).toContain('user: Reconcile the Harborline export');
    expect(prompt).toMatch(/\[\d+ older turns left out\]/);
    const notes = transcriptOf({ agentId: seed.agentId }).filter(
      (event) => event.kind === 'decision_note',
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      message: expect.stringMatching(/^Carried over: \d+ turns?; left out: \d+ older turns?\.$/),
    });
  });

  it('stays quiet about history when the provider did not change', async () => {
    const seed = setupSession();
    seedLongHistory(seed);
    await routeTo({ provider: 'codex' });
    useAppStore.setState({
      runRouting: {
        [seed.agentId]: Object.fromEntries(
          Object.keys(useAppStore.getState().runRouting[seed.agentId] ?? {}).map((runId) => [
            runId,
            { provider: 'codex', model: 'gpt-5.6-sol', effort: null },
          ]),
        ),
      },
    });

    await useAppStore.getState().sendTurn({ sessionId: seed.sessionId, content: 'continue' });

    const notes = transcriptOf({ agentId: seed.agentId }).filter(
      (event) => event.kind === 'decision_note',
    );
    expect(notes).toHaveLength(0);
  });
});
