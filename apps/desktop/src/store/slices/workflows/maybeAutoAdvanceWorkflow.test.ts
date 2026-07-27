import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const { listOpenQuestionsSpy } = vi.hoisted(() => ({
  listOpenQuestionsSpy: vi.fn(async () => []),
}));

vi.mock('@goodboy/db', () => ({
  listOpenQuestionsForSession: listOpenQuestionsSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-1' as WorkflowId;
const SESSION_ID = 'ses-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-27T00:00:00.000Z' as IsoDateTime;

const makeWorkflow = (stepIds: ReadonlyArray<string>): Workflow => ({
  id: WF_ID,
  workspaceId: WS_ID,
  name: 'wf',
  description: '',
  steps: stepIds.map((stepId, i) => ({
    id: stepId as StepId,
    workflowId: WF_ID,
    ordinal: i,
    name: stepId,
    promptPrefix: '',
  })),
  createdAt: NOW,
  updatedAt: NOW,
});

const makeAgent = (stepId: string, status: AgentStatus, ordinal: number): Agent => ({
  id: `${RUN_ID}-${stepId}` as AgentId,
  sessionId: SESSION_ID,
  stepId: stepId as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: stepId,
  status,
});

const makeSession = (): Session => ({
  id: SESSION_ID,
  workspaceId: WS_ID,
  goal: 'g',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: {
    defaultProvider: 'anthropic',
    allowTurnOverride: true,
  } as Session['providerPreference'],
  permissionMode: 'default' as Session['permissionMode'],
  workflowRuns: [
    {
      id: RUN_ID,
      workflowId: WF_ID,
      ordinal: 0,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
    },
  ],
  autoRun: true,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

type StoreState = Record<string, unknown>;

const baseState = (stepIds: ReadonlyArray<string>, agents: ReadonlyArray<Agent>): StoreState => ({
  sessions: [makeSession()],
  phaseTemplates: { [WS_ID]: [makeWorkflow(stepIds)] },
  sessionPhaseRuns: { [SESSION_ID]: agents },
  summarizerStatus: {},
  budgetAlerts: [],
  startWorkflowRun: vi.fn(async () => undefined),
  activateWorkflowAgent: vi.fn(async () => undefined),
  emitNotification: vi.fn(async () => undefined),
});

const harness = (state: StoreState) => {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (s: StoreState) => StoreState)(state));
      return;
    }
    Object.assign(state, updater as StoreState);
  });
  return { set: set as never, get: (() => state) as never };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('maybeAutoAdvanceWorkflow', () => {
  it('activates the next pending step once its predecessors are done', async () => {
    const state = baseState(
      ['s0', 's1', 's2'],
      [
        makeAgent('s0', 'completed', 0),
        makeAgent('s1', 'pending', 1),
        makeAgent('s2', 'pending', 2),
      ],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith(SESSION_ID, `${RUN_ID}-s1`);
  });

  it('does not skip past a step that failed', async () => {
    const state = baseState(
      ['s0', 's1'],
      [makeAgent('s0', 'failed', 0), makeAgent('s1', 'pending', 1)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
  });

  it('spawns a single agent when two advances race', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state = baseState(['s0'], [makeAgent('s0', 'pending', 0)]);
    state['activateWorkflowAgent'] = vi.fn(async () => {
      await gate;
    });
    const { set, get } = harness(state);
    const advance = maybeAutoAdvanceWorkflow(set, get);
    const first = advance(SESSION_ID);
    const second = advance(SESSION_ID);
    release();
    await Promise.all([first, second]);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledTimes(1);
  });

  it('holds while the summarizer runs and advances once it finishes', async () => {
    const state = baseState(['s0'], [makeAgent('s0', 'pending', 0)]);
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);
    const advance = maybeAutoAdvanceWorkflow(set, get);

    await advance(SESSION_ID);
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();

    state['summarizerStatus'] = { [SESSION_ID]: { status: 'idle' } };
    await advance(SESSION_ID);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith(SESSION_ID, `${RUN_ID}-s0`);
  });
});
