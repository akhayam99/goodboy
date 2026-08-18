import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  RoleModelPreferences,
  Session,
  SessionId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';

const { updateOverridesSpy } = vi.hoisted(() => ({
  updateOverridesSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  updateWorkflowRunRoleModelOverrides: updateOverridesSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { setWorkflowRoleModelOverrides } from './setWorkflowRoleModelOverrides';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const OTHER_RUN_ID = 'run-2' as WorkflowRunId;
const NOW = '2026-08-01T00:00:00.000Z' as IsoDateTime;

const IMPLEMENTER_ON_CODEX = {
  implementer: { providerId: 'codex', model: 'gpt-5.6', effort: 'high' },
} satisfies RoleModelPreferences;

type State = Record<string, unknown>;

const session = (roleModelOverrides?: RoleModelPreferences): Session =>
  ({
    id: SESSION_ID,
    workspaceId: 'workspace-1',
    goal: 'Ship it',
    workflowRuns: [
      {
        id: RUN_ID,
        workflowId: 'workflow-1' as WorkflowId,
        ordinal: 0,
        currentStep: 0,
        autoRun: false,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
        ...(roleModelOverrides != null && { roleModelOverrides }),
      },
    ],
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

const runIn = (state: State) => (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setWorkflowRoleModelOverrides', () => {
  it('stores the override on the run it belongs to', async () => {
    const state: State = { sessions: [session()] };
    const { set, get } = harness(state);

    await setWorkflowRoleModelOverrides(set, get)(SESSION_ID, RUN_ID, IMPLEMENTER_ON_CODEX);

    expect(updateOverridesSpy).toHaveBeenCalledWith({}, RUN_ID, IMPLEMENTER_ON_CODEX);
    expect(runIn(state).roleModelOverrides).toEqual(IMPLEMENTER_ON_CODEX);
  });

  it('clears the stored overrides once the last role is reset', async () => {
    const state: State = { sessions: [session(IMPLEMENTER_ON_CODEX)] };
    const { set, get } = harness(state);

    await setWorkflowRoleModelOverrides(set, get)(SESSION_ID, RUN_ID, {});

    expect(updateOverridesSpy).toHaveBeenCalledWith({}, RUN_ID, null);
    expect(runIn(state).roleModelOverrides).toBeUndefined();
  });

  it('writes nothing for a run the session does not carry', async () => {
    const state: State = { sessions: [session()] };
    const { set, get } = harness(state);

    await setWorkflowRoleModelOverrides(set, get)(SESSION_ID, OTHER_RUN_ID, IMPLEMENTER_ON_CODEX);

    expect(updateOverridesSpy).not.toHaveBeenCalled();
    expect(runIn(state).roleModelOverrides).toBeUndefined();
  });
});
