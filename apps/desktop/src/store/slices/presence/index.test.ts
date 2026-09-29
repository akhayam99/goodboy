// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type {
  Agent,
  IsoDateTime,
  ProviderRunId,
  Session,
  TurnState,
  WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent, TEST_NOW } from '@goodboy/types/testing';
import { createPresenceSlice } from './index';

const { focusWindow, spawnWorkspaceWindow } = vi.hoisted(() => ({
  focusWindow: vi.fn(async (_label: string): Promise<boolean> => true),
  spawnWorkspaceWindow: vi.fn(async (_id: string, _title: string): Promise<void> => undefined),
}));

vi.mock('../../../features/workspace/window', () => ({
  currentWindowLabel: () => 'main',
  focusWindow,
  setWindowTitle: vi.fn(async () => undefined),
  spawnWorkspaceWindow,
}));

type FakeState = {
  windowPresence: Record<string, WorkspaceId | null>;
  currentWorkspaceId: WorkspaceId | null;
  sessions: ReadonlyArray<Session>;
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  agentTurnState: Record<string, TurnState>;
  orchestratingWorkflowRuns: Record<string, boolean>;
  setCurrentWorkspace: (id: WorkspaceId | null) => Promise<void>;
  switchWorkspaceHere: (params: { id: WorkspaceId; title: string }) => Promise<void>;
};

function harness(initial: Partial<FakeState>) {
  let state = {
    windowPresence: {},
    currentWorkspaceId: null,
    sessions: [],
    sessionPhaseRuns: {},
    agentTurnState: {},
    orchestratingWorkflowRuns: {},
    setCurrentWorkspace: vi.fn(async () => undefined),
    ...initial,
  } as FakeState;
  const set = (p: unknown) => {
    const patch = typeof p === 'function' ? (p as (s: FakeState) => Partial<FakeState>)(state) : p;
    state = { ...state, ...(patch as Partial<FakeState>) };
  };
  const get = () => state as never;
  const slice = createPresenceSlice(set as never, get);
  state = { ...state, switchWorkspaceHere: slice.switchWorkspaceHere };
  return { slice, get: () => state };
}

const wsA = 'ws-a' as WorkspaceId;
const wsB = 'ws-b' as WorkspaceId;

const AGENT_ID = 'agent-1' as Agent['id'];
const RUN_ID = 'run-1' as Agent['workflowRunId'];

const runningSession = (): Session =>
  aSession({
    id: 'sess-1' as Session['id'],
    state: {
      kind: 'running',
      runId: 'provider-run-1' as ProviderRunId,
      startedAt: TEST_NOW as IsoDateTime,
    },
  });

const idleSession = (): Session =>
  aSession({
    id: 'sess-1' as Session['id'],
    workflowRuns: [aWorkflowRun({ id: 'run-1' as NonNullable<Agent['workflowRunId']> })],
  });

const blockedTurn: TurnState = {
  kind: 'blocked',
  runId: 'provider-run-1' as ProviderRunId,
  blockedAt: TEST_NOW as IsoDateTime,
};

beforeEach(() => {
  focusWindow.mockClear();
  spawnWorkspaceWindow.mockClear();
});

describe('presence slice', () => {
  it('records and removes window presence by label', () => {
    const { slice, get } = harness({});
    slice.setWindowPresence('main', wsA);
    slice.setWindowPresence('win-1', wsB);
    expect(get().windowPresence).toEqual({ main: wsA, 'win-1': wsB });
    slice.removeWindowPresence('win-1');
    expect(get().windowPresence).toEqual({ main: wsA });
  });

  it('focuses the existing window when the workspace is already shown elsewhere', async () => {
    const { slice } = harness({ windowPresence: { 'win-1': wsB }, currentWorkspaceId: wsA });
    const result = await slice.openWorkspace({ id: wsB, title: 'B' });
    expect(focusWindow).toHaveBeenCalledWith('win-1');
    expect(spawnWorkspaceWindow).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'opened' });
  });

  it('loads in place when the calling window has no workspace', async () => {
    const setCurrentWorkspace = vi.fn(async () => undefined);
    const { slice } = harness({ currentWorkspaceId: null, setCurrentWorkspace });
    const result = await slice.openWorkspace({ id: wsA, title: 'A' });
    expect(setCurrentWorkspace).toHaveBeenCalledWith(wsA);
    expect(spawnWorkspaceWindow).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'opened' });
  });

  it('is a no-op when the workspace is already shown in this window', async () => {
    const { slice } = harness({ windowPresence: { main: wsA }, currentWorkspaceId: wsA });
    const result = await slice.openWorkspace({ id: wsA, title: 'A' });
    expect(focusWindow).not.toHaveBeenCalled();
    expect(spawnWorkspaceWindow).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'opened' });
  });

  it('switches in place when nothing is running here', async () => {
    const setCurrentWorkspace = vi.fn(async () => undefined);
    const { slice } = harness({ currentWorkspaceId: wsA, sessions: [], setCurrentWorkspace });
    const result = await slice.openWorkspace({ id: wsB, title: 'B' });
    expect(setCurrentWorkspace).toHaveBeenCalledWith(wsB);
    expect(spawnWorkspaceWindow).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'opened' });
  });

  it('asks for confirmation when agents are running here and onRunning is ask', async () => {
    const setCurrentWorkspace = vi.fn(async () => undefined);
    const { slice } = harness({
      currentWorkspaceId: wsA,
      sessions: [runningSession()],
      setCurrentWorkspace,
    });
    const result = await slice.openWorkspace({ id: wsB, title: 'B' });
    expect(setCurrentWorkspace).not.toHaveBeenCalled();
    expect(spawnWorkspaceWindow).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'needs-confirm', running: 1 });
  });

  it('asks for confirmation when the only agent here waits on an approval', async () => {
    const { slice } = harness({
      currentWorkspaceId: wsA,
      sessions: [idleSession()],
      sessionPhaseRuns: {
        'sess-1': [anAgent({ id: AGENT_ID, sessionId: 'sess-1' as Session['id'] })],
      },
      agentTurnState: { [AGENT_ID]: blockedTurn },
    });
    const result = await slice.openWorkspace({ id: wsB, title: 'B' });
    expect(result).toEqual({ kind: 'needs-confirm', running: 1 });
  });

  it('asks for confirmation while a workflow run is deciding its next step', async () => {
    const { slice } = harness({
      currentWorkspaceId: wsA,
      sessions: [idleSession()],
      orchestratingWorkflowRuns: { 'run-1': true },
    });
    const result = await slice.openWorkspace({ id: wsB, title: 'B' });
    expect(result).toEqual({ kind: 'needs-confirm', running: 1 });
  });

  it('opens a new window without asking when onRunning is new-window', async () => {
    const setCurrentWorkspace = vi.fn(async () => undefined);
    const { slice } = harness({
      currentWorkspaceId: wsA,
      sessions: [runningSession()],
      setCurrentWorkspace,
    });
    const result = await slice.openWorkspace({ id: wsB, title: 'B', onRunning: 'new-window' });
    expect(setCurrentWorkspace).not.toHaveBeenCalled();
    expect(spawnWorkspaceWindow).toHaveBeenCalledWith(wsB, 'B');
    expect(result).toEqual({ kind: 'opened' });
  });

  it('always opens a new window when target is new-window, running or not', async () => {
    const setCurrentWorkspace = vi.fn(async () => undefined);
    const { slice } = harness({ currentWorkspaceId: wsA, sessions: [], setCurrentWorkspace });
    const result = await slice.openWorkspace({ id: wsB, title: 'B', target: 'new-window' });
    expect(setCurrentWorkspace).not.toHaveBeenCalled();
    expect(spawnWorkspaceWindow).toHaveBeenCalledWith(wsB, 'B');
    expect(result).toEqual({ kind: 'opened' });
  });

  it('switchWorkspaceHere switches unconditionally, cancelling running turns along the way', async () => {
    const setCurrentWorkspace = vi.fn(async () => undefined);
    const { slice } = harness({ sessions: [runningSession()], setCurrentWorkspace });
    await slice.switchWorkspaceHere({ id: wsB, title: 'B' });
    expect(setCurrentWorkspace).toHaveBeenCalledWith(wsB);
  });
});
