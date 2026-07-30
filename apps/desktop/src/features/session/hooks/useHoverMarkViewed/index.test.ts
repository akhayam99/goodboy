// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';

const { markAgentSeen } = vi.hoisted(() => ({
  markAgentSeen: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: {
    getState: () => ({ markAgentSeen }),
  },
}));

import { useHoverMarkViewed } from './index';

const SESSION_ID = 'session-hover' as SessionId;
const AGENT_ID = 'agent-hover' as AgentId;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useHoverMarkViewed', () => {
  it('marks the agent seen after a continuous dwell', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useHoverMarkViewed({ sessionId: SESSION_ID, agentId: AGENT_ID, hasUnread: true }),
    );

    act(() => {
      result.current.onMouseEnter?.();
      vi.advanceTimersByTime(450);
    });

    expect(markAgentSeen).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
  });

  it('cancels marking when the pointer leaves early', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useHoverMarkViewed({ sessionId: SESSION_ID, agentId: AGENT_ID, hasUnread: true }),
    );

    act(() => {
      result.current.onMouseEnter?.();
      vi.advanceTimersByTime(449);
      result.current.onMouseLeave?.();
      vi.advanceTimersByTime(1);
    });

    expect(markAgentSeen).not.toHaveBeenCalled();
  });

  it('does not attach handlers or schedule a timer for a read agent', () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const { result } = renderHook(() =>
      useHoverMarkViewed({ sessionId: SESSION_ID, agentId: AGENT_ID, hasUnread: false }),
    );

    expect(result.current.onMouseEnter).toBeUndefined();
    expect(result.current.onMouseLeave).toBeUndefined();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
