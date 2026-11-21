// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import type { ResumeState } from '../session/offerResume';
import { FIX_STOPPED_MESSAGE } from './fixStoppedMessage';
import { stopFixWithResume } from './stopFixWithResume';

const SESSION_ID = brandId<SessionId>({ value: 'session-northwind' });
const AGENT_ID = brandId<AgentId>({ value: 'fix-agent' });

type UndoableParams = Parameters<ResumeState['undoable']>[0];

const worldOf = () => {
  const offered: Array<UndoableParams> = [];
  const state = {
    undoable: vi.fn((params: UndoableParams) => {
      offered.push(params);
      return 'undo-1';
    }),
    continueStoppedAgent: vi.fn(async () => undefined),
    forceCloseResolver: vi.fn(async () => undefined),
    stopResolveLane: vi.fn(async () => undefined),
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

  it('offers nothing when the stop failed, so the old state stays', async () => {
    const { getState, offered, state } = worldOf();
    state.forceCloseResolver.mockRejectedValueOnce(new Error('the resolver did not close'));

    await expect(
      stopFixWithResume({
        getState,
        showToast: vi.fn(),
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        lane: null,
        message: FIX_STOPPED_MESSAGE,
      }),
    ).rejects.toThrow('the resolver did not close');

    expect(offered).toEqual([]);
  });
});
