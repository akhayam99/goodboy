import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../../store';
import type { GetFn, SetFn } from '../types';
import { applyHeuristicTitle } from './index';

const { invokeMock, renameSessionMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  renameSessionMock: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

vi.mock('@goodboy/db', () => ({ renameSession: renameSessionMock }));

vi.mock('../../../../shared/lib/db', () => ({ tauriDatabase: {} }));

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

type Harness = {
  readonly get: GetFn;
  readonly set: SetFn;
  readonly read: () => AppStore;
};

type HarnessParams = {
  readonly agentName?: string;
  readonly titleUserEdited?: boolean;
};

const createHarness = ({
  agentName = 'agent 1',
  titleUserEdited = false,
  agentOrdinal = 0,
}: HarnessParams & { agentOrdinal?: number } = {}): Harness => {
  const session = {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'original goal',
    titleUserEdited,
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  } as unknown as Session;
  const agent = {
    id: AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: agentOrdinal,
    name: agentName,
    status: 'pending',
  } satisfies Agent;
  let state = {
    sessions: [session],
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    workspaceOverrides: {},
  } as unknown as AppStore;
  const set: SetFn = (update) => {
    const partial = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...partial };
  };
  const renameAgent: AppStore['renameAgent'] = async (sessionId, agentId, name) => {
    state = {
      ...state,
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((candidate) =>
          candidate.id === agentId ? { ...candidate, name } : candidate,
        ),
      },
    };
  };
  state = { ...state, renameAgent };
  return { get: () => state, set, read: () => state };
};

describe('applyHeuristicTitle', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    renameSessionMock.mockClear();
  });

  it('replaces eligible heuristic titles with the generated title', async () => {
    invokeMock.mockResolvedValue({
      stdout: JSON.stringify({ result: 'Implement secure authentication flow' }),
      stderr: '',
      exitCode: 0,
    });
    const harness = createHarness();

    await applyHeuristicTitle({
      ...harness,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      prompt: 'Implement a secure authentication flow',
    });

    expect(harness.read().sessions[0]?.goal).toBe('Implement secure authentication flow');
    expect(harness.read().sessionPhaseRuns[SESSION_ID]?.[0]?.name).toBe(
      'Implement secure authentication flow',
    );
    expect(renameSessionMock).toHaveBeenCalledTimes(2);
    expect(invokeMock.mock.calls[0]?.[1]?.args.model).toBe('claude-haiku-4-5');
  });

  it('keeps user titles changed while generation is in flight', async () => {
    let resolveInvoke: (value: unknown) => void = () => undefined;
    const invokeResult = new Promise((resolve) => {
      resolveInvoke = resolve;
    });
    invokeMock.mockReturnValue(invokeResult);
    const harness = createHarness();
    const pending = applyHeuristicTitle({
      ...harness,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      prompt: 'Implement a secure authentication flow',
    });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledOnce());
    harness.set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === SESSION_ID
          ? { ...session, goal: 'User session title', titleUserEdited: true }
          : session,
      ),
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [SESSION_ID]: (state.sessionPhaseRuns[SESSION_ID] ?? []).map((agent) =>
          agent.id === AGENT_ID ? { ...agent, name: 'User agent title' } : agent,
        ),
      },
    }));
    resolveInvoke({ stdout: 'Generated title', stderr: '', exitCode: 0 });
    await pending;

    expect(harness.read().sessions[0]?.goal).toBe('User session title');
    expect(harness.read().sessionPhaseRuns[SESSION_ID]?.[0]?.name).toBe('User agent title');
  });

  it('keeps heuristic titles when generation fails', async () => {
    invokeMock.mockRejectedValue(new Error('offline'));
    const harness = createHarness();

    await applyHeuristicTitle({
      ...harness,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      prompt: 'Implement a secure authentication flow',
    });

    expect(harness.read().sessions[0]?.goal).toBe('implement secure authentication');
    expect(harness.read().sessionPhaseRuns[SESSION_ID]?.[0]?.name).toBe(
      'implement secure authentication',
    );
  });

  it('emits info notification when AI title generation fails', async () => {
    invokeMock.mockRejectedValue(new Error('model offline'));
    const emitNotification = vi.fn(async () => undefined);
    const harness = createHarness();
    const baseGet = harness.get;
    const get = () => ({ ...baseGet(), emitNotification }) as ReturnType<typeof harness.get>;

    await applyHeuristicTitle({
      set: harness.set,
      get,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      prompt: 'Implement a secure authentication flow',
    });

    expect(emitNotification).toHaveBeenCalledWith(
      'title-generation',
      'info',
      'agent title generation failed',
      expect.stringContaining('model offline'),
      expect.objectContaining({ sessionId: SESSION_ID }),
    );
    expect(emitNotification).toHaveBeenCalledTimes(1);
  });

  it('null-heuristic prompt: AI title replaces placeholder agent name', async () => {
    invokeMock.mockResolvedValue({
      stdout: JSON.stringify({ result: 'Fix login crash' }),
      stderr: '',
      exitCode: 0,
    });
    const harness = createHarness({ agentName: 'agent 2', agentOrdinal: 1 });

    await applyHeuristicTitle({
      ...harness,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      prompt: 'fix it',
    });

    expect(harness.read().sessionPhaseRuns[SESSION_ID]?.[0]?.name).toBe('Fix login crash');
    expect(harness.read().sessions[0]?.goal).toBe('original goal');
    expect(invokeMock).toHaveBeenCalledOnce();
  });

  it('null-heuristic prompt + AI failure: leaves agent N and emits info notification', async () => {
    invokeMock.mockRejectedValue(new Error('model offline'));
    const emitNotification = vi.fn(async () => undefined);
    const harness = createHarness({ agentName: 'agent 2', agentOrdinal: 1 });
    const baseGet = harness.get;
    const get = () => ({ ...baseGet(), emitNotification }) as ReturnType<typeof harness.get>;

    await applyHeuristicTitle({
      set: harness.set,
      get,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      prompt: 'fix it',
    });

    expect(harness.read().sessionPhaseRuns[SESSION_ID]?.[0]?.name).toBe('agent 2');
    expect(emitNotification).toHaveBeenCalledWith(
      'title-generation',
      'info',
      'agent title generation failed',
      expect.stringContaining('model offline'),
      expect.objectContaining({ sessionId: SESSION_ID }),
    );
  });

  it('non-founding agent gets AI name but session goal is untouched', async () => {
    invokeMock.mockResolvedValue({
      stdout: JSON.stringify({ result: 'Refactor auth module' }),
      stderr: '',
      exitCode: 0,
    });
    const harness = createHarness({
      agentName: 'agent 3',
      agentOrdinal: 2,
      titleUserEdited: false,
    });

    await applyHeuristicTitle({
      ...harness,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      prompt: 'Refactor the auth module to use tokens',
    });

    expect(harness.read().sessionPhaseRuns[SESSION_ID]?.[0]?.name).toBe('Refactor auth module');
    expect(harness.read().sessions[0]?.goal).toBe('original goal');
    expect(renameSessionMock).not.toHaveBeenCalled();
  });

  it('skips rename when the agent name is not a placeholder', async () => {
    const harness = createHarness({
      agentName: 'Existing agent title',
      titleUserEdited: true,
    });

    await applyHeuristicTitle({
      ...harness,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      prompt: 'Implement a secure authentication flow',
    });

    expect(harness.read().sessions[0]?.goal).toBe('original goal');
    expect(harness.read().sessionPhaseRuns[SESSION_ID]?.[0]?.name).toBe('Existing agent title');
    expect(invokeMock).not.toHaveBeenCalled();
    expect(renameSessionMock).not.toHaveBeenCalled();
  });

  it('keeps heuristic titles when generation times out', async () => {
    vi.useFakeTimers();
    invokeMock.mockReturnValue(new Promise(() => undefined));
    const harness = createHarness();

    try {
      const pending = applyHeuristicTitle({
        ...harness,
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        prompt: 'Implement a secure authentication flow',
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(invokeMock).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(15_000);
      await expect(pending).resolves.toBeUndefined();

      expect(harness.read().sessions[0]?.goal).toBe('implement secure authentication');
      expect(harness.read().sessionPhaseRuns[SESSION_ID]?.[0]?.name).toBe(
        'implement secure authentication',
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
