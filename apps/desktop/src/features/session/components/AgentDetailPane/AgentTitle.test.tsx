// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

const state = vi.hoisted(() => ({
  renameAgent: vi.fn(async () => undefined),
  sessionResolveAttempts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
}));

import { AgentTitle } from './AgentTitle';

const sessionId = 'session-1' as SessionId;
const agent = {
  id: 'agent-1' as AgentId,
  sessionId,
  ordinal: 0,
  name: 'Implement chat',
  status: 'completed',
  kind: 'implementer',
} as Agent;

afterEach(cleanup);

beforeEach(() => {
  state.renameAgent.mockClear();
  state.sessionResolveAttempts = {};
});

describe('AgentTitle', () => {
  it('reads the agent name until someone asks to change it', () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);

    expect(screen.getByText('Implement chat')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('names an automatic fix run title by its pull request and comments, as the Activity row does', () => {
    state.sessionResolveAttempts = {
      [sessionId]: [
        { agentId: 'agent-1', prNumber: 318, threadIds: ['t1', 't2'], createdAt: 1 },
        { agentId: 'agent-1', prNumber: 318, threadIds: ['t3'], createdAt: 2 },
      ],
    };
    render(
      <AgentTitle
        agent={{ ...agent, kind: 'resolver', name: 'Resolve: 3 review comments' } as Agent}
        sessionId={sessionId}
      />,
    );

    expect(screen.getByText('Fix run · #318 · 3 comments')).toBeDefined();
    expect(screen.queryByText(/^Resolve:/)).toBeNull();
  });

  it('keeps a title the owner gave to a fix run', () => {
    state.sessionResolveAttempts = {
      [sessionId]: [{ agentId: 'agent-1', prNumber: 318, threadIds: ['t1'], createdAt: 1 }],
    };
    render(
      <AgentTitle
        agent={{ ...agent, kind: 'resolver', name: 'Webhook retry pass' } as Agent}
        sessionId={sessionId}
      />,
    );

    expect(screen.getByText('Webhook retry pass')).toBeDefined();
  });

  it('opens the field from the rename affordance', () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rename agent' }));

    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('opens the field on a double click, as the agent card does', () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);

    fireEvent.doubleClick(screen.getByText('Implement chat'));

    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('saves the new name on Enter', async () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename agent' }));

    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Ship the chat dock' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await vi.waitFor(() => expect(state.renameAgent).toHaveBeenCalledTimes(1));

    expect(state.renameAgent).toHaveBeenCalledWith(sessionId, 'agent-1', 'Ship the chat dock');
  });

  it('refuses an empty name and leaves the agent alone', () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename agent' }));

    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(state.renameAgent).not.toHaveBeenCalled();
  });
});
