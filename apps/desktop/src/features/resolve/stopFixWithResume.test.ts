// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import type { ResumeState } from '../session/offerResume';
import { FIX_STOPPED_MESSAGE } from './fixStoppedMessage';
import type { LaneStatus } from './laneStatus';
import { stopFixWithResume } from './stopFixWithResume';

const SESSION_ID = brandId<SessionId>({ value: 'session-northwind' });
const AGENT_ID = brandId<AgentId>({ value: 'fix-agent' });

const LANE: LaneStatus = {
  worktreePath: '/repo/ledger-core',
  line: 'Fixing 3 comments',
  total: 3,
  queuedCount: 2,
  rebuildLine: null,
};

type UndoableParams = Parameters<ResumeState['undoable']>[0];

const worldOf = () => {
  const offered: Array<UndoableParams> = [];
  const state = {
    undoable: vi.fn((params: UndoableParams) => {
      offered.push(params);
      return 'undo-1';
    }),
    continueStoppedAgent: vi.fn(async () => undefined),
    agentTurnState: {},
    forceCloseResolver: vi.fn(async (): Promise<'closed' | 'still_running'> => 'closed'),
    stopResolveLane: vi.fn(async (): Promise<ReadonlyArray<AgentId>> => []),
  };
  return { offered, state, getState: () => state };
};

describe('stopFixWithResume', () => {
  it('closes the resolver of a fix with no lane and offers Continue', async () => {
    const { getState, offered, state } = worldOf();

    await stopFixWithResume({
      getState,
      showToast: vi.fn(),
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      lane: null,
      message: FIX_STOPPED_MESSAGE,
    });
    await offered[0]?.undo();

    expect(state.forceCloseResolver).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
    expect(state.stopResolveLane).not.toHaveBeenCalled();
    expect(offered[0]?.message).toBe(FIX_STOPPED_MESSAGE);
    expect(state.continueStoppedAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });
  });

  it('offers nothing when the process did not stop, so the old state stays', async () => {
    const { getState, offered, state } = worldOf();
    state.forceCloseResolver.mockResolvedValueOnce('still_running');
    const showToast = vi.fn();

    await stopFixWithResume({
      getState,
      showToast,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      lane: null,
      message: FIX_STOPPED_MESSAGE,
    });

    expect(offered).toEqual([]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('continues every fix the lane stop closed, the holder first', async () => {
    const { getState, offered, state } = worldOf();
    const holder = brandId<AgentId>({ value: 'fix-holder' });
    const queued = brandId<AgentId>({ value: 'fix-queued' });
    state.stopResolveLane.mockResolvedValueOnce([holder, queued]);

    await stopFixWithResume({
      getState,
      showToast: vi.fn(),
      sessionId: SESSION_ID,
      agentId: queued,
      lane: LANE,
      message: FIX_STOPPED_MESSAGE,
    });
    await offered[0]?.undo();

    expect(state.forceCloseResolver).not.toHaveBeenCalled();
    expect(state.continueStoppedAgent).toHaveBeenNthCalledWith(1, {
      sessionId: SESSION_ID,
      agentId: holder,
    });
    expect(state.continueStoppedAgent).toHaveBeenNthCalledWith(2, {
      sessionId: SESSION_ID,
      agentId: queued,
    });
  });

  it('offers Continue for the lane fixes that closed when another one did not', async () => {
    const { getState, offered, state } = worldOf();
    const closed = brandId<AgentId>({ value: 'fix-closed' });
    state.stopResolveLane.mockResolvedValueOnce([closed]);

    await stopFixWithResume({
      getState,
      showToast: vi.fn(),
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      lane: LANE,
      message: FIX_STOPPED_MESSAGE,
    });
    await offered[0]?.undo();

    expect(state.continueStoppedAgent).toHaveBeenCalledTimes(1);
    expect(state.continueStoppedAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: closed,
    });
  });
});
