import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  ProviderId,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkflowTriggerMode,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const {
  attachInDbSpy,
  updateTriggerModeSpy,
  listOpenQuestionsSpy,
  discardInDbSpy,
  updateSessionStateSpy,
  invokeAgentInsertSpy,
  cancelTurnSpy,
} = vi.hoisted(() => ({
  attachInDbSpy: vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined),
  updateTriggerModeSpy: vi.fn(async () => undefined),
  listOpenQuestionsSpy: vi.fn(async () => []),
  discardInDbSpy: vi.fn(async () => undefined),
  updateSessionStateSpy: vi.fn(async () => undefined),
  invokeAgentInsertSpy: vi.fn(),
  cancelTurnSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  attachWorkflowToSession: attachInDbSpy,
  updateSessionWorkflowTriggerMode: updateTriggerModeSpy,
  listOpenQuestionsForSession: listOpenQuestionsSpy,
  discardWorkflowInSession: discardInDbSpy,
  updateSessionState: updateSessionStateSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
}));
vi.mock('../../../features/chat/turn', () => ({ cancelTurn: cancelTurnSpy }));

import { attachWorkflowToSession } from './attachWorkflowToSession';
import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';
import { startWorkflowRun } from './startWorkflowRun';
import { discardWorkflow } from './discardWorkflow';

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-1' as WorkflowId;
const SESSION_ID = 'ses-1' as SessionId;
const NOW = '2026-06-12T00:00:00.000Z' as IsoDateTime;

function makeWorkflow(
  id: WorkflowId,
  steps: ReadonlyArray<{ stepId: string; name: string }>,
): Workflow {
  return {
    id,
    workspaceId: WS_ID,
    name: 'wf',
    description: '',
    steps: steps.map((s, i) => ({
      id: s.stepId as StepId,
      workflowId: id,
      ordinal: i,
      name: s.name,
      promptPrefix: '',
    })),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeAgent(
  runId: WorkflowRunId,
  stepId: string,
  status: AgentStatus,
  ordinal: number,
): Agent {
  return {
    id: `${runId}-${stepId}` as AgentId,
    sessionId: SESSION_ID,
    stepId: stepId as StepId,
    workflowRunId: runId,
    ordinal,
    name: stepId,
    status,
  };
}

function makeRun(
  id: string,
  triggerMode: WorkflowTriggerMode,
  extra: Partial<WorkflowRun> = {},
): WorkflowRun {
  return {
    id: id as WorkflowRunId,
    workflowId: WF_ID,
    ordinal: 0,
    currentStep: 0,
    autoRun: true,
    triggerMode,
    ...extra,
  };
}

function makeSession(workflowRuns: ReadonlyArray<WorkflowRun>): Session {
  return {
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
    workflowRuns,
    autoRun: true,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

type StoreState = Record<string, unknown>;

function harness(state: StoreState) {
  const setCalls: Array<(s: StoreState) => StoreState> = [];
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      setCalls.push(updater as (s: StoreState) => StoreState);
      Object.assign(state, (updater as (s: StoreState) => StoreState)(state));
    } else {
      Object.assign(state, updater as StoreState);
    }
  });
  const get = (() => state) as never;
  return { set: set as never, get, setCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('maybeAutoAdvanceWorkflow chain detection', () => {
  function baseState(workflowRuns: ReadonlyArray<WorkflowRun>, agents: ReadonlyArray<Agent>) {
    return {
      sessions: [makeSession(workflowRuns)],
      phaseTemplates: { [WS_ID]: [makeWorkflow(WF_ID, [{ stepId: 's0', name: 'Step' }])] },
      sessionPhaseRuns: { [SESSION_ID]: agents },
      summarizerStatus: {},
      budgetAlerts: [],
      startWorkflowRun: vi.fn(async () => undefined),
      activateWorkflowAgent: vi.fn(async () => undefined),
      emitNotification: vi.fn(async () => undefined),
    };
  }

  it('fires startWorkflowRun when the predecessor is complete', async () => {
    const pred = makeRun('pred', 'immediate');
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'pred' as WorkflowRunId,
    });
    const state = baseState(
      [pred, chained],
      [makeAgent('pred' as WorkflowRunId, 's0', 'completed', 0)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['startWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, 'chained');
  });

  it('does not fire when the predecessor is still pending', async () => {
    const pred = makeRun('pred', 'immediate');
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'pred' as WorkflowRunId,
    });
    const state = baseState(
      [pred, chained],
      [makeAgent('pred' as WorkflowRunId, 's0', 'pending', 0)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['startWorkflowRun']).not.toHaveBeenCalled();
  });

  it('does not fire when the predecessor has a failed agent', async () => {
    const pred = makeRun('pred', 'immediate');
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'pred' as WorkflowRunId,
    });
    const state = baseState(
      [pred, chained],
      [makeAgent('pred' as WorkflowRunId, 's0', 'failed', 0)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['startWorkflowRun']).not.toHaveBeenCalled();
  });

  it('eligibility gate: queued after_run run never auto-activates via normal advance', async () => {
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'missing' as WorkflowRunId,
    });
    const state = baseState([chained], [makeAgent('chained' as WorkflowRunId, 's0', 'pending', 0)]);
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
  });

  it('skips a chained candidate that is itself discarded', async () => {
    const pred = makeRun('pred', 'immediate');
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'pred' as WorkflowRunId,
      discardedAt: NOW,
    });
    const state = baseState(
      [pred, chained],
      [makeAgent('pred' as WorkflowRunId, 's0', 'completed', 0)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['startWorkflowRun']).not.toHaveBeenCalled();
  });

  it('skips when the predecessor has been discarded', async () => {
    const pred = makeRun('pred', 'immediate', { discardedAt: NOW });
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'pred' as WorkflowRunId,
    });
    const state = baseState(
      [pred, chained],
      [makeAgent('pred' as WorkflowRunId, 's0', 'completed', 0)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['startWorkflowRun']).not.toHaveBeenCalled();
  });

  it('does not fire when the predecessor run cannot be found', async () => {
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'gone' as WorkflowRunId,
    });
    const state = baseState([chained], []);
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['startWorkflowRun']).not.toHaveBeenCalled();
  });

  it('fires every chained run queued behind one completed predecessor', async () => {
    const pred = makeRun('pred', 'immediate');
    const a = makeRun('a', 'after_run', { chainAfterId: 'pred' as WorkflowRunId });
    const b = makeRun('b', 'after_run', { chainAfterId: 'pred' as WorkflowRunId });
    const state = baseState(
      [pred, a, b],
      [makeAgent('pred' as WorkflowRunId, 's0', 'completed', 0)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['startWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, 'a');
    expect(state['startWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, 'b');
  });

  it('does not advance immediate runs in the same pass that a chain fires', async () => {
    const pred = makeRun('pred', 'immediate');
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'pred' as WorkflowRunId,
    });
    const state = baseState(
      [pred, chained],
      [
        makeAgent('pred' as WorkflowRunId, 's0', 'completed', 0),
        makeAgent('pred' as WorkflowRunId, 's0', 'pending', 0),
      ],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['startWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, 'chained');
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
  });
});

describe('startWorkflowRun', () => {
  function baseState(run: WorkflowRun, agents: ReadonlyArray<Agent>) {
    return {
      sessions: [makeSession([run])],
      sessionPhaseRuns: { [SESSION_ID]: agents },
      maybeAutoAdvanceWorkflow: vi.fn(async () => undefined),
      activateWorkflowAgent: vi.fn(async () => undefined),
    };
  }

  it('flips trigger mode to immediate and delegates to maybeAutoAdvance for autoRun runs', async () => {
    const run = makeRun('q', 'manual', { autoRun: true });
    const state = baseState(run, [makeAgent('q' as WorkflowRunId, 's0', 'pending', 0)]);
    const { set, get } = harness(state);
    await startWorkflowRun(set, get)(SESSION_ID, 'q' as WorkflowRunId);
    expect(updateTriggerModeSpy).toHaveBeenCalledWith(
      {},
      SESSION_ID,
      'q',
      'immediate',
      expect.any(String),
    );
    expect(state['maybeAutoAdvanceWorkflow']).toHaveBeenCalledWith(SESSION_ID);
  });

  it('activates the first pending agent for non-autoRun runs', async () => {
    const run = makeRun('q', 'manual', { autoRun: false });
    const agents = [
      makeAgent('q' as WorkflowRunId, 's0', 'pending', 0),
      makeAgent('q' as WorkflowRunId, 's1', 'pending', 1),
    ];
    const state = baseState(run, agents);
    const { set, get } = harness(state);
    await startWorkflowRun(set, get)(SESSION_ID, 'q' as WorkflowRunId);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith(SESSION_ID, 'q-s0');
  });

  it('is a no-op for an already-immediate run', async () => {
    const run = makeRun('q', 'immediate', { autoRun: true });
    const state = baseState(run, [makeAgent('q' as WorkflowRunId, 's0', 'pending', 0)]);
    const { set, get } = harness(state);
    await startWorkflowRun(set, get)(SESSION_ID, 'q' as WorkflowRunId);
    expect(updateTriggerModeSpy).not.toHaveBeenCalled();
    expect(state['maybeAutoAdvanceWorkflow']).not.toHaveBeenCalled();
  });

  it('flips an after_run run to immediate when started manually', async () => {
    const run = makeRun('q', 'after_run', {
      autoRun: true,
      chainAfterId: 'pred' as WorkflowRunId,
    });
    const state = baseState(run, [makeAgent('q' as WorkflowRunId, 's0', 'pending', 0)]);
    const { set, get } = harness(state);
    await startWorkflowRun(set, get)(SESSION_ID, 'q' as WorkflowRunId);
    expect(updateTriggerModeSpy).toHaveBeenCalledWith(
      {},
      SESSION_ID,
      'q',
      'immediate',
      expect.any(String),
    );
    expect(state['maybeAutoAdvanceWorkflow']).toHaveBeenCalledWith(SESSION_ID);
  });

  it('is a no-op for a discarded run', async () => {
    const run = makeRun('q', 'manual', { autoRun: true, discardedAt: NOW });
    const state = baseState(run, [makeAgent('q' as WorkflowRunId, 's0', 'pending', 0)]);
    const { set, get } = harness(state);
    await startWorkflowRun(set, get)(SESSION_ID, 'q' as WorkflowRunId);
    expect(updateTriggerModeSpy).not.toHaveBeenCalled();
    expect(state['maybeAutoAdvanceWorkflow']).not.toHaveBeenCalled();
  });

  it('is a no-op when the run id is unknown', async () => {
    const run = makeRun('q', 'manual', { autoRun: true });
    const state = baseState(run, []);
    const { set, get } = harness(state);
    await startWorkflowRun(set, get)(SESSION_ID, 'nope' as WorkflowRunId);
    expect(updateTriggerModeSpy).not.toHaveBeenCalled();
  });

  it('non-autoRun run with no pending agents does not activate', async () => {
    const run = makeRun('q', 'manual', { autoRun: false });
    const state = baseState(run, [makeAgent('q' as WorkflowRunId, 's0', 'completed', 0)]);
    const { set, get } = harness(state);
    await startWorkflowRun(set, get)(SESSION_ID, 'q' as WorkflowRunId);
    expect(updateTriggerModeSpy).toHaveBeenCalled();
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
  });
});

describe('discardWorkflow chain flip', () => {
  it('flips after_run runs chained behind the discarded run to manual', async () => {
    const target = makeRun('target', 'immediate');
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'target' as WorkflowRunId,
    });
    const state = {
      sessions: [makeSession([target, chained])],
      sessionPhaseRuns: { [SESSION_ID]: [] as ReadonlyArray<Agent> },
      agentTurnState: {},
    };
    const { set, get, setCalls } = harness(state);
    await discardWorkflow(set, get)(SESSION_ID, 'target' as WorkflowRunId);
    expect(updateTriggerModeSpy).toHaveBeenCalledWith(
      {},
      SESSION_ID,
      'chained',
      'manual',
      expect.any(String),
    );
    const updated = setCalls.at(-1)!(state);
    const sess = (updated['sessions'] as Session[])[0]!;
    const flipped = sess.workflowRuns.find((r) => r.id === ('chained' as WorkflowRunId));
    expect(flipped?.triggerMode).toBe('manual');
  });

  it('flips multiple after_run runs chained behind the discarded run', async () => {
    const target = makeRun('target', 'immediate');
    const a = makeRun('a', 'after_run', { chainAfterId: 'target' as WorkflowRunId });
    const b = makeRun('b', 'after_run', { chainAfterId: 'target' as WorkflowRunId });
    const state = {
      sessions: [makeSession([target, a, b])],
      sessionPhaseRuns: { [SESSION_ID]: [] as ReadonlyArray<Agent> },
      agentTurnState: {},
    };
    const { set, get } = harness(state);
    await discardWorkflow(set, get)(SESSION_ID, 'target' as WorkflowRunId);
    expect(updateTriggerModeSpy).toHaveBeenCalledWith(
      {},
      SESSION_ID,
      'a',
      'manual',
      expect.any(String),
    );
    expect(updateTriggerModeSpy).toHaveBeenCalledWith(
      {},
      SESSION_ID,
      'b',
      'manual',
      expect.any(String),
    );
  });

  it('does not flip immediate runs that merely reference the discarded run', async () => {
    const target = makeRun('target', 'immediate');
    const other = makeRun('other', 'immediate', { chainAfterId: 'target' as WorkflowRunId });
    const state = {
      sessions: [makeSession([target, other])],
      sessionPhaseRuns: { [SESSION_ID]: [] as ReadonlyArray<Agent> },
      agentTurnState: {},
    };
    const { set, get } = harness(state);
    await discardWorkflow(set, get)(SESSION_ID, 'target' as WorkflowRunId);
    expect(updateTriggerModeSpy).not.toHaveBeenCalled();
  });

  it('does not flip an already-discarded chained run', async () => {
    const target = makeRun('target', 'immediate');
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'target' as WorkflowRunId,
      discardedAt: NOW,
    });
    const state = {
      sessions: [makeSession([target, chained])],
      sessionPhaseRuns: { [SESSION_ID]: [] as ReadonlyArray<Agent> },
      agentTurnState: {},
    };
    const { set, get } = harness(state);
    await discardWorkflow(set, get)(SESSION_ID, 'target' as WorkflowRunId);
    expect(updateTriggerModeSpy).not.toHaveBeenCalled();
  });

  it('is a no-op when the target run is already discarded', async () => {
    const target = makeRun('target', 'immediate', { discardedAt: NOW });
    const chained = makeRun('chained', 'after_run', {
      chainAfterId: 'target' as WorkflowRunId,
    });
    const state = {
      sessions: [makeSession([target, chained])],
      sessionPhaseRuns: { [SESSION_ID]: [] as ReadonlyArray<Agent> },
      agentTurnState: {},
    };
    const { set, get } = harness(state);
    await discardWorkflow(set, get)(SESSION_ID, 'target' as WorkflowRunId);
    expect(discardInDbSpy).not.toHaveBeenCalled();
    expect(updateTriggerModeSpy).not.toHaveBeenCalled();
  });
});

describe('attachWorkflowToSession trigger modes', () => {
  function baseState(existingRuns: ReadonlyArray<WorkflowRun>, agents: ReadonlyArray<Agent>) {
    return {
      sessions: [makeSession(existingRuns)],
      phaseTemplates: { [WS_ID]: [makeWorkflow(WF_ID, [{ stepId: 's0', name: 'Implement' }])] },
      sessionPhaseRuns: { [SESSION_ID]: agents },
      providers: [],
      transcripts: {},
      agentTurnState: {},
      agentModelOverride: {} as Record<string, string>,
      agentKindOverride: {} as Record<string, string>,
      agentProviderOverride: {} as Record<string, ProviderId>,
      agentEffortOverride: {} as Record<string, string>,
      sessionWorkflows: {},
      reprocessGoalForWorkflow: vi.fn(async () => undefined),
      maybeAutoAdvanceWorkflow: vi.fn(async () => undefined),
      activateWorkflowAgent: vi.fn(async () => undefined),
    };
  }

  beforeEach(() => {
    let n = 0;
    invokeAgentInsertSpy.mockImplementation(async (args: Record<string, unknown>) => {
      n += 1;
      return {
        id: `agent-${n}` as AgentId,
        sessionId: args['sessionId'] as SessionId,
        stepId: args['stepId'] as StepId,
        workflowRunId: args['workflowRunId'] as WorkflowRunId,
        ordinal: args['ordinal'] as number,
        name: args['name'] as string,
        status: 'pending' as AgentStatus,
      };
    });
  });

  it('immediate (default) autoRun=false activates the first agent', async () => {
    const state = baseState([], []);
    const { set, get } = harness(state);
    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID, { autoRun: false });
    expect(attachInDbSpy.mock.calls[0]?.[7]).toBe('immediate');
    expect(state['activateWorkflowAgent']).toHaveBeenCalled();
  });

  it('manual mode does not activate anything', async () => {
    const state = baseState([], []);
    const { set, get } = harness(state);
    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID, {
      autoRun: false,
      triggerMode: 'manual',
    });
    expect(attachInDbSpy.mock.calls[0]?.[7]).toBe('manual');
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
    expect(state['maybeAutoAdvanceWorkflow']).not.toHaveBeenCalled();
  });

  it('after_run with an incomplete predecessor stays queued', async () => {
    const pred = makeRun('pred', 'immediate');
    const state = baseState([pred], [makeAgent('pred' as WorkflowRunId, 's0', 'pending', 0)]);
    const { set, get } = harness(state);
    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID, {
      autoRun: true,
      triggerMode: 'after_run',
      chainAfterId: 'pred' as WorkflowRunId,
    });
    expect(attachInDbSpy.mock.calls[0]?.[7]).toBe('after_run');
    expect(attachInDbSpy.mock.calls[0]?.[8]).toBe('pred');
    expect(state['maybeAutoAdvanceWorkflow']).not.toHaveBeenCalled();
  });

  it('after_run degrades to immediate when the predecessor is already complete', async () => {
    const pred = makeRun('pred', 'immediate');
    const state = baseState([pred], [makeAgent('pred' as WorkflowRunId, 's0', 'completed', 0)]);
    const { set, get } = harness(state);
    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID, {
      autoRun: true,
      triggerMode: 'after_run',
      chainAfterId: 'pred' as WorkflowRunId,
    });
    expect(attachInDbSpy.mock.calls[0]?.[7]).toBe('immediate');
    expect(state['maybeAutoAdvanceWorkflow']).toHaveBeenCalledWith(SESSION_ID);
  });

  it('after_run does not degrade when the predecessor was discarded', async () => {
    const pred = makeRun('pred', 'immediate', { discardedAt: NOW });
    const state = baseState([pred], [makeAgent('pred' as WorkflowRunId, 's0', 'completed', 0)]);
    const { set, get } = harness(state);
    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID, {
      autoRun: true,
      triggerMode: 'after_run',
      chainAfterId: 'pred' as WorkflowRunId,
    });
    expect(attachInDbSpy.mock.calls[0]?.[7]).toBe('after_run');
    expect(state['maybeAutoAdvanceWorkflow']).not.toHaveBeenCalled();
  });

  it('after_run stays queued when the predecessor cannot be found', async () => {
    const state = baseState([], []);
    const { set, get } = harness(state);
    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID, {
      autoRun: true,
      triggerMode: 'after_run',
      chainAfterId: 'ghost' as WorkflowRunId,
    });
    expect(attachInDbSpy.mock.calls[0]?.[7]).toBe('after_run');
    expect(state['maybeAutoAdvanceWorkflow']).not.toHaveBeenCalled();
  });

  it('persists chainAfterId onto the new run in store state', async () => {
    const pred = makeRun('pred', 'immediate');
    const state = baseState([pred], [makeAgent('pred' as WorkflowRunId, 's0', 'pending', 0)]);
    const { set, get } = harness(state);
    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID, {
      autoRun: true,
      triggerMode: 'after_run',
      chainAfterId: 'pred' as WorkflowRunId,
    });
    const sess = (state['sessions'] as Session[])[0]!;
    const added = sess.workflowRuns.find((r) => r.triggerMode === 'after_run');
    expect(added?.chainAfterId).toBe('pred');
  });

  it('immediate autoRun delegates to maybeAutoAdvance', async () => {
    const state = baseState([], []);
    const { set, get } = harness(state);
    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID, { autoRun: true });
    expect(attachInDbSpy.mock.calls[0]?.[7]).toBe('immediate');
    expect(state['maybeAutoAdvanceWorkflow']).toHaveBeenCalledWith(SESSION_ID);
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
  });

  it('uses the step provider when recommending the attached agent model', async () => {
    const state = baseState([], []);
    const workflow = makeWorkflow(WF_ID, [{ stepId: 's0', name: 'Scout' }]);
    state.phaseTemplates = {
      [WS_ID]: [
        {
          ...workflow,
          steps: workflow.steps.map((step) => ({
            ...step,
            role: 'scout' as const,
            providerOverride: 'cursor' as const,
          })),
        },
      ],
    };
    const { set, get } = harness(state);

    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID, { autoRun: false });

    expect(state.agentProviderOverride['agent-1']).toBe('cursor');
    expect(state.agentModelOverride['agent-1']).toBe('auto');
  });
});
