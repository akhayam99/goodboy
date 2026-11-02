import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type ProviderRunId,
  type StepId,
  type TurnEvent,
} from '@goodboy/types';
import { TEST_NOW, aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryAgent,
  buildStoryWorkspace,
  connectedAnthropicState,
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

const RUN_ID = brandId<ProviderRunId>({ value: 'run-step-end' });
const AT = TEST_NOW;

const run = aWorkflowRun();
const session = aSession({ workflowRuns: [run] });
const workspace = buildStoryWorkspace({ id: session.workspaceId, name: 'harborline', slug: 'hb' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-scout-harborline' });

const stepAgent = (): Agent =>
  buildStoryAgent({
    id: AGENT_ID,
    sessionId: session.id,
    name: 'Scout',
    workflowRunId: run.id,
    stepId: brandId<StepId>({ value: 'step-scout' }),
    status: 'running',
  });

let useAppStore: StoryStore;
let row: Agent;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const deltas = (parts: ReadonlyArray<string>) =>
  async function* stream(): AsyncIterable<TurnEvent> {
    for (const delta of parts) {
      yield { kind: 'assistant_text', runId: RUN_ID, delta, at: AT };
    }
    yield {
      kind: 'usage',
      runId: RUN_ID,
      usage: {
        inputTokens: 54,
        outputTokens: 12755,
        cachedInputTokens: 1563153,
        cacheCreationInputTokens: 0,
        estimatedCostUsd: 0,
      },
      at: AT,
    };
    yield { kind: 'done', runId: RUN_ID, at: AT };
  };

const sendStepTurn = async (parts: ReadonlyArray<string>): Promise<void> => {
  storySpies.runTurn.mockImplementation(deltas(parts));
  await useAppStore
    .getState()
    .sendTurn({ sessionId: session.id, agentId: AGENT_ID, content: 'scout the ledger-core pages' });
};

const completedAgentIds = (): ReadonlyArray<string> =>
  storySpies.invokeAgentUpdateStatus.mock.calls
    .filter(([, fields]) => fields.status === 'completed')
    .map(([id]) => String(id));

describe('a workflow step turn that ends with a handoff marker and a step-done marker', () => {
  beforeEach(() => {
    resetStorySpies();
    row = stepAgent();
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

  it('completes the step when both markers arrive in one delta', async () => {
    await sendStepTurn([
      'Report written.\n<<handoff kind=planner reason="plan the fix">>\n<<step-done id="agent-scout-harborline">>',
    ]);

    await vi.waitFor(() => expect(completedAgentIds()).toContain(AGENT_ID));
    expect(useAppStore.getState().sessionNudges?.[session.id] ?? null).toBeNull();
  });

  it('completes the step when the step-done marker is split across deltas', async () => {
    await sendStepTurn([
      'Report written.\n<<handoff kind=planner reason="plan the fix">>\n',
      '<<step-done id="agent-scout',
      '-harborline">>',
    ]);

    await vi.waitFor(() => expect(completedAgentIds()).toContain(AGENT_ID));
  });

  it('completes the step when the handoff marker comes after the step-done marker', async () => {
    await sendStepTurn([
      '<<step-done id="agent-scout-harborline">>\n<<handoff kind=planner reason="plan the fix">>',
    ]);

    await vi.waitFor(() => expect(completedAgentIds()).toContain(AGENT_ID));
  });
});

describe('a workflow step turn that stops without a step-done marker', () => {
  const handsFreeRun = aWorkflowRun({ autoRun: true });
  const handsFreeSession = aSession({ workflowRuns: [handsFreeRun] });

  beforeEach(() => {
    resetStorySpies();
    row = buildStoryAgent({
      id: AGENT_ID,
      sessionId: handsFreeSession.id,
      name: 'Scout',
      workflowRunId: handsFreeRun.id,
      stepId: brandId<StepId>({ value: 'step-scout' }),
      status: 'running',
    });
    storySpies.invokeAgentList.mockImplementation(async () => [row]);
    storySpies.invokeAgentUpdateStatus.mockImplementation(async (_id, fields) => {
      row = { ...row, status: fields.status };
      return row;
    });
    useAppStore.setState({
      sessions: [handsFreeSession],
      projects: [],
      workflowContinueAttempts: {},
      sessionPhaseRuns: { [handsFreeSession.id]: [row] },
      selectedAgentId: { [handsFreeSession.id]: AGENT_ID },
      transcripts: {},
      notifications: [],
      workspaces: [
        buildStoryWorkspace({ id: handsFreeSession.workspaceId, name: 'harborline', slug: 'hb' }),
      ],
      ...connectedAnthropicState(),
    });
  });

  it('nudges it once with the same step-done instruction as the kickoff', async () => {
    storySpies.runTurn.mockImplementation(deltas(['Looked at the pages, more to read.']));
    await useAppStore.getState().sendTurn({
      sessionId: handsFreeSession.id,
      agentId: AGENT_ID,
      content: 'scout the ledger-core pages',
    });

    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(2));
    const second: unknown = storySpies.runTurn.mock.calls[1]?.[0];
    const prompt = String(Reflect.get(Object(second), 'prompt'));
    expect(prompt).toContain('You stopped before finishing this workflow step.');
    expect(prompt).toContain(`<<step-done id="${AGENT_ID}">>`);
    expect(prompt).toContain('<<ctx-question blocking="true">>');
  });

  it('writes no ended-without-result line when the normal path already blocked the step', async () => {
    vi.useFakeTimers();
    useAppStore.setState({
      sessions: [
        aSession({
          id: handsFreeSession.id,
          workspaceId: handsFreeSession.workspaceId,
          workflowRuns: [aWorkflowRun({ id: handsFreeRun.id, autoRun: false })],
        }),
      ],
    });
    storySpies.runTurn.mockImplementation(deltas(['Looked at the pages, more to read.']));
    await useAppStore.getState().sendTurn({
      sessionId: handsFreeSession.id,
      agentId: AGENT_ID,
      content: 'scout the ledger-core pages',
    });
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();

    expect(row.status).toBe('blocked');
    const lines = storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'log_step_end');
    expect(lines).toEqual([]);
  });
});
