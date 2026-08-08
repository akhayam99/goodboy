import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  Session,
  SessionId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const { updateAutoRunSpy, updateStopSpy, updateOutcomeSpy } = vi.hoisted(() => ({
  updateAutoRunSpy: vi.fn(async () => undefined),
  updateStopSpy: vi.fn(async () => undefined),
  updateOutcomeSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  updateSessionWorkflowAutoRun: updateAutoRunSpy,
  updateWorkflowRunOrchestrationStop: updateStopSpy,
  updateWorkflowRunOrchestrationOutcome: updateOutcomeSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { retryWorkflowOrchestration } from './retryWorkflowOrchestration';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-08-08T00:00:00.000Z' as IsoDateTime;

type State = Record<string, unknown>;

type SessionParams = {
  readonly autoRun: boolean;
  readonly stopKind: 'operator' | 'failure';
};

const session = ({ autoRun, stopKind }: SessionParams): Session =>
  ({
    id: SESSION_ID,
    workspaceId: 'workspace-1' as WorkspaceId,
    goal: 'Ship the change',
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
        autoRun,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
        orchestrationStop: { kind: stopKind, message: 'stopped' },
      },
    ],
    autoRun,
    titleUserEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
  }) satisfies Session;

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

const runOf = (state: State) => (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('retryWorkflowOrchestration', () => {
  it('puts a run stopped by the operator back on hands-free', async () => {
    const state: State = {
      sessions: [session({ autoRun: false, stopKind: 'operator' })],
      orchestrateNextStep: vi.fn(async () => undefined),
    };
    const { set, get } = harness(state);

    await retryWorkflowOrchestration(set, get)(SESSION_ID, RUN_ID);

    expect(runOf(state).autoRun).toBe(true);
    expect(runOf(state).orchestrationStop).toBeUndefined();
    expect(state['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('leaves a manual run manual when the stop was not the operator', async () => {
    const state: State = {
      sessions: [session({ autoRun: false, stopKind: 'failure' })],
      orchestrateNextStep: vi.fn(async () => undefined),
    };
    const { set, get } = harness(state);

    await retryWorkflowOrchestration(set, get)(SESSION_ID, RUN_ID);

    expect(runOf(state).autoRun).toBe(false);
    expect(updateAutoRunSpy).not.toHaveBeenCalled();
  });
});
