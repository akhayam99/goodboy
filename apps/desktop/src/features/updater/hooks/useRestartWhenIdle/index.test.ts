// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { Session } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';

const { state } = vi.hoisted(() => ({
  state: {
    updateQueuedUntilIdle: false,
    agentTurnState: {} as Record<string, { kind: string }>,
    sessions: [] as ReadonlyArray<Session>,
    sessionPhaseRuns: {},
    orchestratingWorkflowRuns: {} as Record<string, boolean>,
    applyUpdate: vi.fn(async () => undefined),
    setUpdateQueuedUntilIdle: vi.fn(({ queued }: { readonly queued: boolean }) => {
      state.updateQueuedUntilIdle = queued;
    }),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (s: typeof state) => T) => selector(state),
}));

import { useRestartWhenIdle } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  state.updateQueuedUntilIdle = false;
  state.agentTurnState = {};
  state.sessions = [];
  state.orchestratingWorkflowRuns = {};
});

afterEach(cleanup);

describe('useRestartWhenIdle', () => {
  it('does nothing when not queued, even with zero agents running', () => {
    renderHook(() => useRestartWhenIdle());

    expect(state.applyUpdate).not.toHaveBeenCalled();
  });

  it('does nothing while queued and agents are still running', () => {
    state.updateQueuedUntilIdle = true;
    state.agentTurnState = { a: { kind: 'running' } };

    renderHook(() => useRestartWhenIdle());

    expect(state.applyUpdate).not.toHaveBeenCalled();
  });

  it('applies the update and clears the queue once agents reach zero while queued', () => {
    state.updateQueuedUntilIdle = true;
    state.agentTurnState = {};

    renderHook(() => useRestartWhenIdle());

    expect(state.setUpdateQueuedUntilIdle).toHaveBeenCalledWith({ queued: false });
    expect(state.applyUpdate).toHaveBeenCalledOnce();
  });

  it('applies the update on the render right after the count drops to zero', () => {
    state.updateQueuedUntilIdle = true;
    state.agentTurnState = { a: { kind: 'running' } };

    const { rerender } = renderHook(() => useRestartWhenIdle());
    expect(state.applyUpdate).not.toHaveBeenCalled();

    state.agentTurnState = {};
    rerender();

    expect(state.applyUpdate).toHaveBeenCalledOnce();
  });

  it('waits while a workflow run is deciding its next step between two agents', () => {
    const run = aWorkflowRun();
    state.updateQueuedUntilIdle = true;
    state.sessions = [aSession({ workflowRuns: [run] })];
    state.orchestratingWorkflowRuns = { [run.id]: true };

    const { rerender } = renderHook(() => useRestartWhenIdle());
    expect(state.applyUpdate).not.toHaveBeenCalled();

    state.orchestratingWorkflowRuns = {};
    rerender();

    expect(state.applyUpdate).toHaveBeenCalledOnce();
  });
});
