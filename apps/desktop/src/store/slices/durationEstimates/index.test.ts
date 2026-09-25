import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, MeasuredTurnSpan, SessionId, WorkspaceId } from '@goodboy/types';

const { listWorkspaceSpy, listSessionSpy, listEverySpy } = vi.hoisted(() => ({
  listWorkspaceSpy: vi.fn(),
  listSessionSpy: vi.fn(),
  listEverySpy: vi.fn(),
}));

vi.mock('@goodboy/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/db')>();
  return {
    ...actual,
    listWorkspaceTurnSpans: listWorkspaceSpy,
    listSessionTurnSpans: listSessionSpy,
    listTurnSpans: listEverySpy,
  };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { createDurationEstimatesSlice } from './index';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;

const SPAN: MeasuredTurnSpan = {
  agentId: 'agent-1' as AgentId,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
  startedAtMs: 0,
  endedAtMs: 240_000,
  endReason: 'succeeded',
  costUsd: 0.4,
  touchedMountIds: null,
};

const harness = () => {
  let state: Record<string, unknown> = {};
  const set = (
    patch: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>),
  ) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get = () => state;
  const slice = createDurationEstimatesSlice(set as never, get as never);
  state = { ...slice };
  return { slice, read: () => state };
};

beforeEach(() => {
  listWorkspaceSpy.mockReset();
  listSessionSpy.mockReset();
  listEverySpy.mockReset();
});

describe('duration estimates slice', () => {
  it('turns workspace and app-wide spans into step and turn samples', async () => {
    listWorkspaceSpy.mockResolvedValue([SPAN]);
    listEverySpy.mockResolvedValue([SPAN, { ...SPAN, agentId: 'agent-2' as AgentId }]);
    const { slice, read } = harness();

    await slice.loadWorkspaceDurationHistory({ workspaceId: WORKSPACE_ID });

    const sample = {
      role: 'implementer',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      effort: 'medium',
      activeMs: 240_000,
      costUsd: 0.4,
      endedAtMs: 240_000,
    };
    expect(read().workspaceDurationHistory).toEqual({
      [WORKSPACE_ID]: {
        steps: [sample],
        turns: [sample],
        everyWorkspace: { steps: [sample, sample], turns: [sample, sample] },
        orchestratedRuns: [],
      },
    });
  });

  it('reloads only what a pane already loaded once a turn closes', async () => {
    listSessionSpy.mockResolvedValue([SPAN]);
    const { slice, read } = harness();

    await slice.refreshTurnSpans({ sessionId: SESSION_ID, workspaceId: WORKSPACE_ID });
    expect(listSessionSpy).not.toHaveBeenCalled();

    await slice.loadSessionTurnSpans({ sessionId: SESSION_ID });
    await slice.refreshTurnSpans({ sessionId: SESSION_ID, workspaceId: WORKSPACE_ID });

    expect(listSessionSpy).toHaveBeenCalledTimes(2);
    expect(listWorkspaceSpy).not.toHaveBeenCalled();
    expect(read().sessionTurnSpans).toEqual({ [SESSION_ID]: [SPAN] });
  });

  it('keeps the last good history when a read fails', async () => {
    listWorkspaceSpy.mockRejectedValue(new Error('locked'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { slice, read } = harness();

    await slice.loadWorkspaceDurationHistory({ workspaceId: WORKSPACE_ID });

    expect(read().workspaceDurationHistory).toEqual({});
    error.mockRestore();
  });
});
