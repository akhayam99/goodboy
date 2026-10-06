import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { WorkflowGateError } from '../../store/slices/workflows/workflowActivationGate';

const { state } = vi.hoisted(() => ({
  state: {
    activateWorkflowAgent: vi.fn(async (_params: unknown): Promise<void> => undefined),
    emitNotification: vi.fn(async (_params: unknown) => undefined),
    reportError: vi.fn(async (_params: unknown) => undefined),
  },
}));

vi.mock('../../store', () => ({
  useAppStore: <T>(selector: (store: typeof state) => T) => selector(state),
}));

import { useAdvanceWorkflowAgent } from './useAdvanceWorkflowAgent';

const SESSION_ID = 'session-northwind' as SessionId;
const AGENT = {
  id: 'agent-tester' as AgentId,
  sessionId: SESSION_ID,
  status: 'pending',
} as unknown as Agent;

beforeEach(() => {
  state.activateWorkflowAgent.mockReset();
  state.emitNotification.mockClear();
  state.reportError.mockClear();
});

describe('useAdvanceWorkflowAgent', () => {
  it('logs a failed start once instead of throwing it at the caller', async () => {
    state.activateWorkflowAgent.mockRejectedValueOnce(new Error('the worktree is gone'));
    const { result } = renderHook(() => useAdvanceWorkflowAgent({ sessionId: SESSION_ID }));

    await expect(result.current({ agent: AGENT })).resolves.toBeUndefined();

    expect(state.reportError).toHaveBeenCalledTimes(1);
    expect(state.reportError).toHaveBeenCalledWith({
      title: "The next step didn't start",
      error: new Error('the worktree is gone'),
      sessionId: SESSION_ID,
    });
  });

  it('keeps a held back step as a warning, not an error', async () => {
    state.activateWorkflowAgent.mockRejectedValueOnce(
      new WorkflowGateError({ reason: 'questions' }),
    );
    const { result } = renderHook(() => useAdvanceWorkflowAgent({ sessionId: SESSION_ID }));

    await result.current({ agent: AGENT });

    expect(state.reportError).not.toHaveBeenCalled();
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warning', title: 'Run step held back' }),
    );
  });
});
