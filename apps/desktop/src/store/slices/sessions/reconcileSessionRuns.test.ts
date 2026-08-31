import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, IsoDateTime, ProviderRunId, Session } from '@goodboy/types';

const { cancelTurn, updateAgentStatus, updateSessionState } = vi.hoisted(() => ({
  cancelTurn: vi.fn(async () => undefined),
  updateAgentStatus: vi.fn(async () => undefined),
  updateSessionState: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({ updateAgentStatus, updateSessionState }));
vi.mock('../../../features/chat/turn', () => ({ cancelTurn }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { reconcileLoadedAgent, reconcileLoadedSessions } from './reconcileSessionRuns';

const NOW = '2026-08-31T10:00:00.000Z' as IsoDateTime;
const RUN_ID = 'run-1' as ProviderRunId;

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

  it('persists a running agent as pending', async () => {
    const agent = buildAgent({ status: 'running' });

    const reconciled = await reconcileLoadedAgent({ agent, liveRunIds: new Set([RUN_ID]) });

    expect(cancelTurn).toHaveBeenCalledWith(RUN_ID);
    expect(updateAgentStatus).toHaveBeenCalledWith({}, agent.id, { status: 'pending' });
    expect(reconciled.status).toBe('pending');
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
    expect(updateAgentStatus).not.toHaveBeenCalled();
  });
});
