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

const { updateSpendLimitSpy } = vi.hoisted(() => ({
  updateSpendLimitSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({ updateWorkflowRunSpendLimit: updateSpendLimitSpy }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { setWorkflowRunSpendLimit } from './setWorkflowRunSpendLimit';

const SESSION_ID = 'ses-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-08-14T00:00:00.000Z' as IsoDateTime;

const session = (spendLimitUsd?: number): Session => ({
  id: SESSION_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'g',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [
    {
      id: RUN_ID,
      workflowId: 'wf-1' as WorkflowId,
      ordinal: 0,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'dynamic',
      ...(spendLimitUsd != null && { spendLimitUsd }),
    },
  ],
  autoRun: true,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

type State = Record<string, unknown>;

const harness = (state: State) => {
  const set = vi.fn((updater: unknown) => {
    Object.assign(
      state,
      typeof updater === 'function' ? (updater as (s: State) => State)(state) : (updater as State),
    );
  });
  return { set: set as never, get: (() => state) as never };
};

const runOf = (state: State) => (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setWorkflowRunSpendLimit', () => {
  it('writes the limit and mode the operator picked', async () => {
    const state: State = { sessions: [session()] };
    const { set, get } = harness(state);

    await setWorkflowRunSpendLimit(set, get)(SESSION_ID, RUN_ID, 12.5, 'notify');

    expect(updateSpendLimitSpy).toHaveBeenCalledWith({}, RUN_ID, 12.5, 'notify');
    expect(runOf(state).spendLimitUsd).toBe(12.5);
    expect(runOf(state).spendLimitMode).toBe('notify');
  });

  it('drops the limit key entirely when the operator clears it', async () => {
    const state: State = { sessions: [session(12.5)] };
    const { set, get } = harness(state);

    await setWorkflowRunSpendLimit(set, get)(SESSION_ID, RUN_ID, null, 'pause');

    expect(updateSpendLimitSpy).toHaveBeenCalledWith({}, RUN_ID, null, 'pause');
    expect('spendLimitUsd' in runOf(state)).toBe(false);
    expect(runOf(state).spendLimitMode).toBe('pause');
  });

  it('reads a non-positive limit as no limit at all', async () => {
    const state: State = { sessions: [session(12.5)] };
    const { set, get } = harness(state);

    await setWorkflowRunSpendLimit(set, get)(SESSION_ID, RUN_ID, 0, 'pause');

    expect(updateSpendLimitSpy).toHaveBeenCalledWith({}, RUN_ID, null, 'pause');
    expect('spendLimitUsd' in runOf(state)).toBe(false);
  });

  it('touches nothing for a run the session does not have', async () => {
    const state: State = { sessions: [session()] };
    const { set, get } = harness(state);

    await setWorkflowRunSpendLimit(set, get)(SESSION_ID, 'run-9' as WorkflowRunId, 5, 'pause');

    expect(updateSpendLimitSpy).not.toHaveBeenCalled();
  });
});
