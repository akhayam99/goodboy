import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Session, SessionId, WorkflowId, WorkflowRunId } from '@goodboy/types';

const { updateOutcomeSpy, updateHintsSpy } = vi.hoisted(() => ({
  updateOutcomeSpy: vi.fn(async () => undefined),
  updateHintsSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  updateWorkflowRunOrchestrationOutcome: updateOutcomeSpy,
  updateWorkflowRunOrchestrationError: vi.fn(async () => undefined),
  updateWorkflowRunOrchestratorHints: updateHintsSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { continueWorkflowRun } from './continueWorkflowRun';
import { setWorkflowOrchestratorHints } from './setWorkflowOrchestratorHints';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-31T00:00:00.000Z' as IsoDateTime;

type State = Record<string, unknown>;

const session = (overrides: Record<string, unknown> = {}): Session =>
  ({
    id: SESSION_ID,
    workspaceId: 'workspace-1',
    goal: 'Ship it',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
    permissionMode: 'default',
    workflowRuns: [
      {
        id: RUN_ID,
        workflowId: 'workflow-1' as WorkflowId,
        ordinal: 0,
        currentStep: 0,
        autoRun: true,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
        orchestrationOutcome: 'done',
        orchestrationError: 'boom',
        ...overrides,
      },
    ],
    autoRun: true,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  }) as unknown as Session;

const harness = (state: State) => {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (current: State) => State)(state));
      return;
    }
    Object.assign(state, updater as State);
  });
  return { set: set as never, get: (() => state) as never };
};

const baseState = (overrides: Record<string, unknown> = {}): State => {
  const state: State = {
    sessions: [session(overrides)],
    orchestrateNextStep: vi.fn(async () => undefined),
  };
  const { set, get } = harness(state);
  state['setWorkflowOrchestratorHints'] = setWorkflowOrchestratorHints(set, get);
  return state;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('continueWorkflowRun', () => {
  it('reopens a completed run and asks the orchestrator for more', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    await continueWorkflowRun(set, get)(SESSION_ID, RUN_ID);

    expect(updateOutcomeSpy).toHaveBeenCalledWith({}, RUN_ID, null);
    const run = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(run.orchestrationOutcome).toBeUndefined();
    expect(run.orchestrationError).toBeUndefined();
    expect(state['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {});
  });

  it('hands the note to the orchestrator once without pinning it to the hints', async () => {
    const state = baseState({ orchestratorHints: 'skip the docs' });
    const { set, get } = harness(state);

    await continueWorkflowRun(set, get)(SESSION_ID, RUN_ID, '  also check the migrations  ');

    expect(updateHintsSpy).not.toHaveBeenCalled();
    expect(state['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      extraHints: 'also check the migrations',
    });
    const run = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(run.orchestratorHints).toBe('skip the docs');
  });

  it('leaves a static run alone', async () => {
    const state = baseState({ executionMode: 'static' });
    const { set, get } = harness(state);

    await continueWorkflowRun(set, get)(SESSION_ID, RUN_ID);

    expect(updateOutcomeSpy).not.toHaveBeenCalled();
    expect(state['orchestrateNextStep']).not.toHaveBeenCalled();
  });
});

describe('setWorkflowOrchestratorHints', () => {
  it('drops the hints when the operator clears the field', async () => {
    const state = baseState({ orchestratorHints: 'skip the docs' });
    const { set, get } = harness(state);

    await setWorkflowOrchestratorHints(set, get)(SESSION_ID, RUN_ID, '   ');

    expect(updateHintsSpy).toHaveBeenCalledWith({}, RUN_ID, null);
    const run = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(run.orchestratorHints).toBeUndefined();
  });
});
