import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { TEST_NOW, anAgent, nextProviderRunId } from '@goodboy/types/testing';
import { seedSessionWithMounts } from '../__tests__/helpers/seedSessionWithMounts';
import { agentLiveKey } from '../features/chat/reveal/agentLiveKey';
import { liveTextRegistry } from '../features/chat/reveal/liveTextRegistry';
import { revealPacer } from '../features/chat/reveal/revealPacer';

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

const ANSWER = 'The migration in payments-api adds a column to ledger-core. ';
const LONG_TEXT = ANSWER.repeat(20);

type RunParams = {
  readonly runId: ProviderRunId;
};

type Seed = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

let useAppStore: StoryStore;
let spawnedRunId: ProviderRunId | null = null;
let streamAgentId: AgentId | null = null;

const answerStream = async function* ({ runId }: RunParams): AsyncIterable<TurnEvent> {
  spawnedRunId = runId;
  yield { kind: 'assistant_text', runId, delta: ANSWER, at: TEST_NOW };
};

const answerThenErrorStream = async function* ({ runId }: RunParams): AsyncIterable<TurnEvent> {
  spawnedRunId = runId;
  yield { kind: 'assistant_text', runId, delta: ANSWER, at: TEST_NOW };
  revealPacer.track({ key: `${runId}:text-1`, text: LONG_TEXT, isComplete: true, startCut: 0 });
  if (streamAgentId !== null) {
    revealPacer.track({
      key: `${agentLiveKey({ agentId: streamAgentId })}:finding`,
      text: LONG_TEXT,
      isComplete: true,
      startCut: 0,
    });
  }
  yield { kind: 'error', runId, message: 'connection reset by peer', at: TEST_NOW };
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

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('live text mark', () => {
  beforeEach(async () => {
    resetStorySpies();
    liveTextRegistry.clear();
    revealPacer.reset();
    spawnedRunId = null;
    streamAgentId = null;
    const routingMod = await import('../features/providers/routing');
    vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-3-5-sonnet-latest',
      reason: 'preferred',
      fallbackUsed: false,
    });
  });

  afterEach(() => {
    revealPacer.reset();
    vi.clearAllMocks();
  });

  it('marks the run live when text comes through the turn stream', async () => {
    runTurnSpy.mockImplementation((args: RunParams) => answerStream({ runId: args.runId }));
    const { sessionId, agentId } = setupSession();

    await useAppStore.getState().sendTurn({ sessionId, content: 'hello' });

    expect(spawnedRunId).not.toBeNull();
    expect(liveTextRegistry.isLive({ runId: spawnedRunId ?? nextProviderRunId() })).toBe(true);
    expect(liveTextRegistry.isLive({ runId: agentLiveKey({ agentId }) })).toBe(true);
  });

  it('never marks text that is loaded or replayed through appendTurnEvent', () => {
    const runId = nextProviderRunId();
    const { sessionId, agentId } = setupSession();

    useAppStore.getState().appendTurnEvent(agentId, sessionId, {
      kind: 'assistant_text',
      runId,
      delta: ANSWER,
      at: TEST_NOW,
    });

    expect(liveTextRegistry.isLive({ runId })).toBe(false);
    expect(liveTextRegistry.isLive({ runId: agentLiveKey({ agentId }) })).toBe(false);
  });

  it('finishes the reveal of the run before an error row lands', async () => {
    runTurnSpy.mockImplementation((args: RunParams) =>
      answerThenErrorStream({ runId: args.runId }),
    );
    const { sessionId } = setupSession();

    await useAppStore.getState().sendTurn({ sessionId, content: 'hello' });

    const snapshot = revealPacer.snapshotOf({ key: `${spawnedRunId}:text-1` });
    expect(snapshot?.cut).toBe(LONG_TEXT.length);
  });

  it('finishes the agent keyed text of the run before an error row lands', async () => {
    runTurnSpy.mockImplementation((args: RunParams) =>
      answerThenErrorStream({ runId: args.runId }),
    );
    const { sessionId, agentId } = setupSession();
    streamAgentId = agentId;

    await useAppStore.getState().sendTurn({ sessionId, content: 'hello' });

    const snapshot = revealPacer.snapshotOf({ key: `${agentLiveKey({ agentId })}:finding` });
    expect(snapshot?.cut).toBe(LONG_TEXT.length);
  });

  it('leaves the agent keyed text of another agent revealing on an error', async () => {
    runTurnSpy.mockImplementation((args: RunParams) =>
      answerThenErrorStream({ runId: args.runId }),
    );
    const { sessionId } = setupSession();
    const otherKey = `${agentLiveKey({ agentId: 'agent-northwind' })}:finding`;
    revealPacer.track({ key: otherKey, text: LONG_TEXT, isComplete: true, startCut: 0 });

    await useAppStore.getState().sendTurn({ sessionId, content: 'hello' });

    expect(revealPacer.snapshotOf({ key: otherKey })?.cut).toBeLessThan(LONG_TEXT.length);
  });
});
