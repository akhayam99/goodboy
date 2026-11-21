// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TurnState,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import type { CancelOutcome } from '../../store/slices/turn/cancelTurnConfirmed';
import { offerResume, type ResumeState } from './offerResume';
import { stopAllWithResume } from './stopAllWithResume';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

const idOf = (value: string): AgentId => brandId<AgentId>({ value });

const EXITED: CancelOutcome = { outcome: 'exited', exitedAt: null };

type UndoableParams = Parameters<ResumeState['undoable']>[0];

const resumeWorld = () => {
  const offered: Array<UndoableParams> = [];
  const continueStoppedAgent = vi.fn(async () => undefined);
  const undoable = vi.fn((params: UndoableParams) => {
    offered.push(params);
    return 'undo-1';
  });
  const state: { -readonly [K in keyof ResumeState]: ResumeState[K] } = {
    undoable,
    continueStoppedAgent,
    agentTurnState: {},
  };
  return { offered, continueStoppedAgent, undoable, state, getState: () => state };
};

describe('offerResume', () => {
  it('offers nothing when no agent was stopped', () => {
    const { getState, undoable } = resumeWorld();

    const id = offerResume({
      getState,
      sessionId: SESSION_ID,
      agentIds: [],
      message: 'Stopped 0',
      showToast: vi.fn(),
    });

    expect(id).toBeNull();
    expect(undoable).not.toHaveBeenCalled();
  });

  it('names the verb Continue and continues each stopped agent from the toast', async () => {
    const { getState, offered, continueStoppedAgent } = resumeWorld();

    offerResume({
      getState,
      sessionId: SESSION_ID,
      agentIds: [idOf('agent-a'), idOf('agent-b')],
      message: 'Stopped 2',
      showToast: vi.fn(),
    });
    await offered[0]?.undo();

    expect(offered[0]?.actionLabel).toBe('Continue');
    expect(offered[0]?.message).toBe('Stopped 2');
    expect(continueStoppedAgent).toHaveBeenCalledTimes(2);
    expect(continueStoppedAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: idOf('agent-a'),
    });
  });

  it('lets the failure of one agent reach the undo, which reports it', async () => {
    const { getState, offered, continueStoppedAgent } = resumeWorld();
    continueStoppedAgent.mockRejectedValueOnce(new Error('provider is signed out'));

    offerResume({
      getState,
      sessionId: SESSION_ID,
      agentIds: [idOf('agent-a'), idOf('agent-b')],
      message: 'Stopped 2',
      showToast: vi.fn(),
    });

    await expect(offered[0]?.undo()).rejects.toThrow('provider is signed out');
    expect(continueStoppedAgent).toHaveBeenCalledTimes(2);
  });

  it('retries only the agents that failed, never the ones already continued', async () => {
    const { getState, offered, continueStoppedAgent } = resumeWorld();
    continueStoppedAgent.mockRejectedValueOnce(new Error('provider is signed out'));

    offerResume({
      getState,
      sessionId: SESSION_ID,
      agentIds: [idOf('agent-a'), idOf('agent-b')],
      message: 'Stopped 2',
      showToast: vi.fn(),
    });
    await expect(offered[0]?.undo()).rejects.toThrow('provider is signed out');
    await offered[0]?.undo();

    expect(continueStoppedAgent).toHaveBeenCalledTimes(3);
    expect(continueStoppedAgent).toHaveBeenLastCalledWith({
      sessionId: SESSION_ID,
      agentId: idOf('agent-a'),
    });
  });

  it('skips an agent that runs again, so a manual Continue is not doubled', async () => {
    const { getState, offered, continueStoppedAgent, state } = resumeWorld();
    const idle = (value: string) => ({
      kind: 'idle' as const,
      lastActivityAt: brandId<IsoDateTime>({ value }),
    });
    state.agentTurnState = {
      [idOf('agent-a')]: idle('2026-11-21T09:00:00.000Z'),
      [idOf('agent-b')]: idle('2026-11-21T09:00:00.000Z'),
    };

    offerResume({
      getState,
      sessionId: SESSION_ID,
      agentIds: [idOf('agent-a'), idOf('agent-b')],
      message: 'Stopped 2',
      showToast: vi.fn(),
    });
    state.agentTurnState = {
      [idOf('agent-a')]: {
        kind: 'running',
        runId: brandId<ProviderRunId>({ value: 'run-a' }),
        startedAt: brandId<IsoDateTime>({ value: '2026-11-21T09:05:00.000Z' }),
      },
      [idOf('agent-b')]: idle('2026-11-21T09:00:00.000Z'),
    };
    await offered[0]?.undo();

    expect(continueStoppedAgent).toHaveBeenCalledTimes(1);
    expect(continueStoppedAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: idOf('agent-b'),
    });
  });

  it('is no longer current once every captured agent moved on', () => {
    const { getState, offered, state } = resumeWorld();
    state.agentTurnState = {
      [idOf('agent-a')]: { kind: 'idle', lastActivityAt: brandId<IsoDateTime>({ value: 'a1' }) },
    };

    offerResume({
      getState,
      sessionId: SESSION_ID,
      agentIds: [idOf('agent-a')],
      message: 'Stopped 1',
      showToast: vi.fn(),
    });
    expect(offered[0]?.isCurrent?.()).toBe(true);
    state.agentTurnState = {
      [idOf('agent-a')]: { kind: 'idle', lastActivityAt: brandId<IsoDateTime>({ value: 'a2' }) },
    };

    expect(offered[0]?.isCurrent?.()).toBe(false);
  });
});

describe('stopAllWithResume', () => {
  const stopWorld = () => {
    const resume = resumeWorld();
    const agents = ['agent-a', 'agent-b'].map((id) =>
      anAgent({ id: idOf(id), sessionId: SESSION_ID, status: 'running' }),
    );
    const showToast = vi.fn();
    const turns: Record<string, TurnState> = Object.fromEntries(
      agents.map((agent) => [
        agent.id,
        {
          kind: 'running' as const,
          runId: brandId<ProviderRunId>({ value: `run-${agent.id}` }),
          startedAt: brandId<IsoDateTime>({ value: '2026-11-21T09:00:00.000Z' }),
        },
      ]),
    );
    const state = {
      ...resume.getState(),
      sessions: [],
      orchestratingWorkflowRuns: {},
      stopWorkflowRunNow: vi.fn(async () => 'stopped' as const),
      sessionPhaseRuns: { [SESSION_ID]: agents },
      agentTurnState: turns,
      cancelTurnConfirmed: vi.fn(async ({ agentId }: { readonly agentId: AgentId }) => {
        state.agentTurnState = {
          ...state.agentTurnState,
          [agentId]: {
            kind: 'idle' as const,
            lastActivityAt: brandId<IsoDateTime>({ value: '2026-11-21T09:01:00.000Z' }),
          },
        };
        return EXITED;
      }),
      reportError: vi.fn(async () => undefined),
    };
    return { ...resume, showToast, state, getState: () => state };
  };

  it('stops at once, asks nothing and offers Continue for the agents it stopped', async () => {
    const { getState, showToast, offered, state } = stopWorld();

    await stopAllWithResume({ getState, sessionId: SESSION_ID, showToast });

    expect(state.cancelTurnConfirmed).toHaveBeenCalledTimes(2);
    expect(offered).toHaveLength(1);
    expect(offered[0]?.actionLabel).toBe('Continue');
    await offered[0]?.undo();
    expect(state.continueStoppedAgent).toHaveBeenCalledTimes(2);
  });

  it('offers Continue only for the agents whose stop was confirmed', async () => {
    const { getState, showToast, offered, state } = stopWorld();
    const stopped = state.cancelTurnConfirmed.getMockImplementation();
    state.cancelTurnConfirmed.mockImplementation(async (params) => {
      if (params.agentId === idOf('agent-b')) {
        return { outcome: 'still_running', exitedAt: null } satisfies CancelOutcome;
      }
      return (await stopped?.(params)) ?? EXITED;
    });

    await stopAllWithResume({ getState, sessionId: SESSION_ID, showToast });
    await offered[0]?.undo();

    expect(state.continueStoppedAgent).toHaveBeenCalledTimes(1);
    expect(state.continueStoppedAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: idOf('agent-a'),
    });
  });

  it('says so in a plain toast when nothing was running', async () => {
    const { getState, showToast, state, offered } = stopWorld();
    state.sessionPhaseRuns = { [SESSION_ID]: [] };

    await stopAllWithResume({ getState, sessionId: SESSION_ID, showToast });

    expect(offered).toEqual([]);
    expect(showToast).toHaveBeenCalledWith({ kind: 'info', message: 'Stopped 0' });
  });
});
