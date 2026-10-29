import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import { TEST_NOW, aSession } from '@goodboy/types/testing';
import { lingeringTurns } from '../features/chat/lingeringTurns';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryAgent,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  resetStorySpies,
  storySpies,
  stubStoryInvoke,
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

const RUN_ID = brandId<ProviderRunId>({ value: 'run-send-after-result' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-scout-northwind' });
const session = aSession();
const workspace = buildStoryWorkspace({ id: session.workspaceId, name: 'northwind', slug: 'nw' });

let useAppStore: StoryStore;
let row: Agent;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const answer = (text: string): TurnEvent => ({
  kind: 'assistant_text',
  runId: RUN_ID,
  delta: text,
  at: TEST_NOW,
});

const resultEvent: TurnEvent = { kind: 'done', runId: RUN_ID, at: TEST_NOW };

describe('an operator message sent while the previous turn still lingers after its result', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStorySpies();
    row = buildStoryAgent({ id: AGENT_ID, sessionId: session.id, name: 'scout' });
    storySpies.invokeAgentList.mockImplementation(async () => [row]);
    storySpies.invokeAgentUpdateStatus.mockImplementation(async (_id, fields) => {
      row = { ...row, status: fields.status };
      return row;
    });
    useAppStore.setState({
      sessions: [session],
      projects: [],
      sessionPhaseRuns: { [session.id]: [row] },
      selectedAgentId: { [session.id]: AGENT_ID },
      transcripts: {},
      notifications: [],
      workspaces: [workspace],
      ...connectedAnthropicState(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the second turn only after the first one is finalized', async () => {
    const release: { open: () => void } = { open: () => undefined };
    const lingering = new Promise<void>((resolve) => {
      release.open = resolve;
    });
    const order: string[] = [];
    storySpies.runTurn
      .mockImplementationOnce(async function* first(): AsyncIterable<TurnEvent> {
        order.push('first started');
        yield answer('Scouting finished.');
        yield resultEvent;
        await lingering;
        order.push('first stream closed');
      })
      .mockImplementationOnce(async function* second(): AsyncIterable<TurnEvent> {
        order.push('second started');
        yield answer('No, I am not stuck.');
        yield resultEvent;
      });

    const first = useAppStore
      .getState()
      .sendTurn({ sessionId: session.id, agentId: AGENT_ID, content: 'scout the pages' });
    await vi.waitFor(() => expect(order).toContain('first started'));
    await vi.waitFor(() =>
      expect(useAppStore.getState().agentTurnState[AGENT_ID]?.kind).toBe('idle'),
    );

    const second = useAppStore.getState().sendTurn({
      sessionId: session.id,
      agentId: AGENT_ID,
      content: 'are you stuck?',
      origin: 'operator',
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);

    release.open();
    await first;
    await second;

    expect(order).toEqual(['first started', 'first stream closed', 'second started']);
    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
  });

  it('does not hold back a message when nothing lingers', async () => {
    storySpies.runTurn.mockImplementation(async function* only(): AsyncIterable<TurnEvent> {
      yield answer('Done.');
      yield resultEvent;
    });

    await useAppStore.getState().sendTurn({
      sessionId: session.id,
      agentId: AGENT_ID,
      content: 'scout the pages',
      origin: 'operator',
    });

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
  });

  it('stops the process that lingers after the result of the previous turn', async () => {
    stubStoryInvoke({ turn_cancel: null });
    lingeringTurns.mark({ agentId: AGENT_ID, runId: RUN_ID });
    storySpies.runTurn.mockImplementation(async function* only(): AsyncIterable<TurnEvent> {
      yield answer('No, I am not stuck.');
      yield resultEvent;
    });

    await useAppStore.getState().sendTurn({
      sessionId: session.id,
      agentId: AGENT_ID,
      content: 'are you stuck?',
      origin: 'operator',
    });
    lingeringTurns.clear({ agentId: AGENT_ID, runId: RUN_ID });

    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('turn_cancel', { runId: RUN_ID });
  });
});
