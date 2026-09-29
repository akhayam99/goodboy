import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, IsoDateTime, ProviderRunId, Session } from '@goodboy/types';

const { cancelTurn, isTurnStreamActive, recordAgentStatus, updateSessionState } = vi.hoisted(
  () => ({
    isTurnStreamActive: vi.fn((_params: { readonly runId: string }) => false),
    cancelTurn: vi.fn(async () => undefined),
    recordAgentStatus: vi.fn(async () => undefined),
    updateSessionState: vi.fn(async () => undefined),
  }),
);

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({ recordAgentStatus, updateSessionState }),
);
vi.mock('../../../features/chat/turn', () => ({ cancelTurn, isTurnStreamActive }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { writeTurnCursor, type TurnOwner } from '../../../features/chat/turnCursor';
import {
  reattachableTurn,
  reconcileLoadedAgent,
  reconcileLoadedSessions,
} from './reconcileSessionRuns';

const NOW = '2026-08-31T10:00:00.000Z' as IsoDateTime;
const RUN_ID = 'run-1' as ProviderRunId;
const OWNER: TurnOwner = {
  agentId: 'agent-1' as never,
  sessionId: 'session-1' as never,
  workspaceId: 'workspace-1' as never,
  workflowRunId: null,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  startedAt: NOW,
  workingDir: '/tmp/worktree',
  mountId: null,
};

const buildSession = ({ state }: Pick<Session, 'state'>): Session => ({
  id: 'session-1' as never,
  workspaceId: 'workspace-1' as never,
  goal: 'recover',
  state,
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

const buildAgent = ({ status }: Pick<Agent, 'status'>): Agent => ({
  id: 'agent-1' as never,
  sessionId: 'session-1' as never,
  ordinal: 0,
  name: 'agent',
  status,
  runId: RUN_ID,
});

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('loaded run reconciliation', () => {
  it('persists an absent running session as idle without cancellation', async () => {
    const session = buildSession({ state: { kind: 'running', runId: RUN_ID, startedAt: NOW } });

    const [reconciled] = await reconcileLoadedSessions({
      sessions: [session],
      liveRunIds: new Set(),
      now: NOW,
    });

    expect(cancelTurn).not.toHaveBeenCalled();
    expect(updateSessionState).toHaveBeenCalledWith(
      {},
      session.id,
      { kind: 'idle', lastActivityAt: NOW },
      NOW,
    );
    expect(reconciled?.state).toEqual({ kind: 'idle', lastActivityAt: NOW });
  });

  it('cancels a live running session before persisting it as idle', async () => {
    const session = buildSession({ state: { kind: 'running', runId: RUN_ID, startedAt: NOW } });

    await reconcileLoadedSessions({
      sessions: [session],
      liveRunIds: new Set([RUN_ID]),
      now: NOW,
    });

    expect(cancelTurn).toHaveBeenCalledWith(RUN_ID);
    expect(cancelTurn.mock.invocationCallOrder[0]).toBeLessThan(
      updateSessionState.mock.invocationCallOrder[0] ?? 0,
    );
    expect(updateSessionState).toHaveBeenCalledOnce();
  });

  it('persists a running agent as stopped by the app', async () => {
    const agent = buildAgent({ status: 'running' });

    const reconciled = await reconcileLoadedAgent({ agent, liveRunIds: new Set([RUN_ID]) });

    expect(cancelTurn).toHaveBeenCalledWith(RUN_ID);
    expect(recordAgentStatus).toHaveBeenCalledWith({}, agent.id, {
      status: 'stopped',
      stoppedAt: expect.any(String),
      stoppedBy: 'app',
    });
    expect(reconciled.status).toBe('stopped');
    expect(reconciled.stoppedBy).toBe('app');
  });

  it('keeps a running agent this window was streaming before it reloaded', async () => {
    const agent = buildAgent({ status: 'running' });
    writeTurnCursor({ runId: RUN_ID, cursor: { seq: 3, index: 0, owner: OWNER } });

    const reconciled = await reconcileLoadedAgent({ agent, liveRunIds: new Set([RUN_ID]) });
    const [session] = await reconcileLoadedSessions({
      sessions: [buildSession({ state: { kind: 'running', runId: RUN_ID, startedAt: NOW } })],
      liveRunIds: new Set([RUN_ID]),
      now: NOW,
    });

    expect(reconciled).toBe(agent);
    expect(session?.state.kind).toBe('running');
    expect(cancelTurn).not.toHaveBeenCalled();
    expect(recordAgentStatus).not.toHaveBeenCalled();
    expect(reattachableTurn({ agent })).toEqual({
      runId: RUN_ID,
      cursor: { seq: 3, index: 0, owner: OWNER },
    });
  });

  it('never re-attaches a run another agent owns or a stream still open here', async () => {
    const agent = buildAgent({ status: 'running' });
    writeTurnCursor({
      runId: RUN_ID,
      cursor: { seq: 3, index: 0, owner: { ...OWNER, agentId: 'agent-2' as never } },
    });
    expect(reattachableTurn({ agent })).toBeNull();

    writeTurnCursor({ runId: RUN_ID, cursor: { seq: 3, index: 0, owner: OWNER } });
    isTurnStreamActive.mockReturnValue(true);
    expect(reattachableTurn({ agent })).toBeNull();
    expect(await reconcileLoadedAgent({ agent, liveRunIds: new Set([RUN_ID]) })).toBe(agent);
    isTurnStreamActive.mockReturnValue(false);
  });

  it('returns settled records with the same references', async () => {
    const session = buildSession({ state: { kind: 'idle', lastActivityAt: NOW } });
    const agent = buildAgent({ status: 'completed' });

    const [reconciledSession] = await reconcileLoadedSessions({
      sessions: [session],
      liveRunIds: new Set(),
      now: NOW,
    });
    const reconciledAgent = await reconcileLoadedAgent({ agent, liveRunIds: new Set() });

    expect(reconciledSession).toBe(session);
    expect(reconciledAgent).toBe(agent);
    expect(updateSessionState).not.toHaveBeenCalled();
    expect(recordAgentStatus).not.toHaveBeenCalled();
  });
});
