import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type OpenQuestion,
  type OpenQuestionId,
  type StepId,
  type TurnEvent,
} from '@goodboy/types';
import { TEST_NOW, aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from '../../../storyHarness';
import { watchStepEnd } from './watchStepEnd';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../storyHarness')).dbModuleMock());
vi.mock('../../../../features/workflows/workflows', async () =>
  (await import('../../../storyHarness')).workflowsModuleMock(),
);

const run = aWorkflowRun();
const session = aSession({ workflowRuns: [run] });
const workspace = buildStoryWorkspace({ id: session.workspaceId, name: 'harborline', slug: 'hb' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-scout-harborline' });
const CHILD_ID = brandId<AgentId>({ value: 'agent-child-harborline' });

const stepAgent = (overrides: Partial<Agent> = {}): Agent =>
  anAgent({
    id: AGENT_ID,
    sessionId: session.id,
    name: 'Scout',
    workflowRunId: run.id,
    stepId: brandId<StepId>({ value: 'step-scout' }),
    status: 'running',
    ...overrides,
  });

let useAppStore: StoryStore;
let rows: Agent[];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const logLines = (): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([command]) => command === 'log_step_end')
    .map(([, args]) => args);

const statusOf = (): string | undefined => rows.find((row) => row.id === AGENT_ID)?.status;

const arm = (): void => {
  watchStepEnd({
    set: useAppStore.setState,
    get: useAppStore.getState,
    sessionId: session.id,
    agentId: AGENT_ID,
  });
};

const question = (overrides: Partial<OpenQuestion> = {}): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: 'question-1' }),
  sessionId: session.id,
  createdByAgentId: AGENT_ID,
  text: 'Which export first?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: TEST_NOW,
  ...overrides,
});

describe('the step end watch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStorySpies();
    rows = [stepAgent()];
    storySpies.invokeAgentList.mockImplementation(async () => rows);
    storySpies.invokeAgentUpdateStatus.mockImplementation(async (id, fields) => {
      rows = rows.map((row) => (row.id === id ? { ...row, status: fields.status } : row));
      const updated = rows.find((row) => row.id === id);
      if (updated === undefined) {
        throw new Error('no agent');
      }
      return updated;
    });
    useAppStore.setState({
      sessions: [session],
      sessionPhaseRuns: { [session.id]: rows },
      agentTurnState: { [AGENT_ID]: { kind: 'idle', lastActivityAt: TEST_NOW } },
      sessionOpenQuestions: {},
      notifications: [],
      workspaces: [workspace],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks a step that ended with nothing continuing it, tells the user and logs one line', async () => {
    arm();
    await vi.advanceTimersByTimeAsync(4100);

    expect(statusOf()).toBe('blocked');
    expect(logLines()).toEqual([
      { agent: AGENT_ID, reason: expect.stringContaining('still running') },
    ]);
    expect(
      useAppStore.getState().notifications.some((entry) => entry.title.includes('Scout')),
    ).toBe(true);
  });

  it('leaves a step alone while a new turn runs for it', async () => {
    useAppStore.setState({
      agentTurnState: {
        [AGENT_ID]: {
          kind: 'running',
          runId: brandId<Extract<TurnEvent, { kind: 'done' }>['runId']>({ value: 'run-2' }),
          startedAt: TEST_NOW,
        },
      },
    });
    arm();
    await vi.advanceTimersByTimeAsync(4100);

    expect(statusOf()).toBe('running');
    expect(logLines()).toEqual([]);
  });

  it('leaves a step alone while it waits on an answer of the user', async () => {
    useAppStore.setState({ sessionOpenQuestions: { [session.id]: [question()] } });
    arm();
    await vi.advanceTimersByTimeAsync(4100);

    expect(statusOf()).toBe('running');
    expect(logLines()).toEqual([]);
  });

  it('flags the step again once the question is answered and nothing else runs', async () => {
    useAppStore.setState({
      sessionOpenQuestions: {
        [session.id]: [question({ status: 'answered', userAnswer: 'ledger-core first' })],
      },
    });
    arm();
    await vi.advanceTimersByTimeAsync(4100);

    expect(statusOf()).toBe('blocked');
  });

  it('leaves a step alone while one of its children still works', async () => {
    rows = [
      stepAgent(),
      anAgent({ id: CHILD_ID, sessionId: session.id, parentAgentId: AGENT_ID, status: 'running' }),
    ];
    useAppStore.setState({ sessionPhaseRuns: { [session.id]: rows } });
    arm();
    await vi.advanceTimersByTimeAsync(4100);

    expect(statusOf()).toBe('running');
  });

  it('leaves a step that already completed or blocked on its own', async () => {
    rows = [stepAgent({ status: 'completed' })];
    useAppStore.setState({ sessionPhaseRuns: { [session.id]: rows } });
    arm();
    await vi.advanceTimersByTimeAsync(4100);
    expect(logLines()).toEqual([]);

    rows = [stepAgent({ status: 'blocked' })];
    useAppStore.setState({ sessionPhaseRuns: { [session.id]: rows } });
    arm();
    await vi.advanceTimersByTimeAsync(4100);
    expect(logLines()).toEqual([]);
  });

  it('ignores an agent that is not a workflow step', async () => {
    rows = [anAgent({ id: AGENT_ID, sessionId: session.id, status: 'running' })];
    useAppStore.setState({ sessionPhaseRuns: { [session.id]: rows } });
    arm();
    await vi.advanceTimersByTimeAsync(4100);

    expect(statusOf()).toBe('running');
    expect(logLines()).toEqual([]);
  });

  it('checks once when it is armed twice in a row', async () => {
    arm();
    arm();
    await vi.advanceTimersByTimeAsync(4100);

    expect(logLines()).toHaveLength(1);
  });

  it('shows the failure and keeps the step as it was when the status write fails', async () => {
    storySpies.invokeAgentUpdateStatus.mockRejectedValue(new Error('database is locked'));
    arm();
    await vi.advanceTimersByTimeAsync(4100);

    expect(statusOf()).toBe('running');
    expect(logLines()).toEqual([]);
    expect(
      useAppStore
        .getState()
        .notifications.some((entry) => entry.title === "Couldn't mark the step as ended"),
    ).toBe(true);
  });
});

describe('marking a blocked step done', () => {
  beforeEach(() => {
    resetStorySpies();
    rows = [stepAgent({ status: 'blocked' })];
    storySpies.invokeAgentList.mockImplementation(async () => rows);
    storySpies.invokeAgentUpdateStatus.mockImplementation(async (id, fields) => {
      rows = rows.map((row) => (row.id === id ? { ...row, status: fields.status } : row));
      const updated = rows.find((row) => row.id === id);
      if (updated === undefined) {
        throw new Error('no agent');
      }
      return updated;
    });
    useAppStore.setState({
      sessions: [session],
      sessionPhaseRuns: { [session.id]: rows },
      agentTurnState: { [AGENT_ID]: { kind: 'idle', lastActivityAt: TEST_NOW } },
      transcripts: {
        [AGENT_ID]: [
          {
            kind: 'assistant_text',
            runId: brandId<Extract<TurnEvent, { kind: 'done' }>['runId']>({ value: 'run-1' }),
            delta: 'Traced the rounding to post_line in ledger-core.',
            at: TEST_NOW,
          },
        ],
      },
      notifications: [],
      workspaces: [workspace],
    });
  });

  it('completes the step without a marker and keeps the closing words as its output', async () => {
    await useAppStore.getState().markStepDone({ sessionId: session.id, agentId: AGENT_ID });

    expect(statusOf()).toBe('completed');
    expect(rows.find((row) => row.id === AGENT_ID)).toBeDefined();
  });

  it('does nothing for a step whose turn is running', async () => {
    useAppStore.setState({
      agentTurnState: {
        [AGENT_ID]: {
          kind: 'running',
          runId: brandId<Extract<TurnEvent, { kind: 'done' }>['runId']>({ value: 'run-3' }),
          startedAt: TEST_NOW,
        },
      },
    });
    await useAppStore.getState().markStepDone({ sessionId: session.id, agentId: AGENT_ID });

    expect(statusOf()).toBe('blocked');
  });

  it('does nothing for an agent outside a workflow', async () => {
    rows = [anAgent({ id: AGENT_ID, sessionId: session.id, status: 'blocked' })];
    useAppStore.setState({ sessionPhaseRuns: { [session.id]: rows } });
    await useAppStore.getState().markStepDone({ sessionId: session.id, agentId: AGENT_ID });

    expect(statusOf()).toBe('blocked');
  });
});
