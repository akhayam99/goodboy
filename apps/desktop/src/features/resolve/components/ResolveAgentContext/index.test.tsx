// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-7' as AgentId;

const h = vi.hoisted(() => {
  const state = {
    resolveAgentReturn: {} as Record<string, unknown>,
    returnFromResolveAgent: vi.fn(),
  };
  const useAppStore = Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
  });
  return { state, useAppStore, rows: [] as ReadonlyArray<unknown> };
});

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: h.useAppStore,
}));
vi.mock('../../hooks/useResolveQueueRows', () => ({
  useResolveQueueRows: () => h.rows,
}));

import { ResolveAgentContext } from './index';

const withOrigin = (): void => {
  h.state.resolveAgentReturn = {
    [SESSION_ID]: { agentId: AGENT_ID, threadId: 't-parser', prNumber: 264, view: {} },
  };
};

afterEach(() => {
  cleanup();
  h.state.resolveAgentReturn = {};
  h.rows = [];
  h.state.returnFromResolveAgent.mockClear();
});

describe('the strip that says which comment sent you to this agent', () => {
  it('stays away when no comment sent you here', () => {
    render(<ResolveAgentContext sessionId={SESSION_ID} agentId={AGENT_ID} />);

    expect(screen.queryByRole('button', { name: 'Back to comment' })).toBeNull();
  });

  it('stays away on an agent the origin does not name', () => {
    withOrigin();

    render(<ResolveAgentContext sessionId={SESSION_ID} agentId={'agent-9' as AgentId} />);

    expect(screen.queryByRole('button', { name: 'Back to comment' })).toBeNull();
  });

  it('names the pull request and sends you back to the comment', () => {
    withOrigin();

    render(<ResolveAgentContext sessionId={SESSION_ID} agentId={AGENT_ID} />);
    expect(screen.getByText(/PR #264/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to comment' }));

    expect(h.state.returnFromResolveAgent).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  it('carries the comment status once the queue knows it', () => {
    withOrigin();
    h.rows = [
      { thread: { threadId: 't-parser' }, status: 'fix_ready', coveredThreadIds: ['t-client'] },
    ];

    render(<ResolveAgentContext sessionId={SESSION_ID} agentId={AGENT_ID} />);

    expect(screen.getByText(/Fix ready, on your machine/)).toBeTruthy();
    expect(screen.getByText(/Shared run · 2 comments/)).toBeTruthy();
  });
});
