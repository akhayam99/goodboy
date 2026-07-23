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

const createHarness = (): Harness => {
  const session = {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'original goal',
    titleUserEdited: false,
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  } as unknown as Session;
  const agent = {
    id: AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent 1',
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
});
