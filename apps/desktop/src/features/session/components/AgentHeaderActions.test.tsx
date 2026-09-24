// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

const { deleteAgent } = vi.hoisted(() => ({ deleteAgent: vi.fn() }));

vi.mock('../../../store', () => {
  const state = {
    setAgentDone: vi.fn(),
    clearAgentDone: vi.fn(),
    cancelCurrentTurn: vi.fn(),
    deleteAgent,
    agentTurnState: {},
  };
  return {
    useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
  };
});

import { AgentHeaderActions } from './AgentHeaderActions';

const agent = { id: 'agent-1' as AgentId, doneAt: null } as unknown as Agent;
const sessionId = 'sess-1' as SessionId;

afterEach(() => {
  cleanup();
  deleteAgent.mockReset();
});

describe('AgentHeaderActions delete', () => {
  it('keeps the confirm armed and names the failure when delete throws', async () => {
    deleteAgent.mockRejectedValueOnce(new Error('database is locked'));
    const onDeleted = vi.fn();
    render(<AgentHeaderActions agent={agent} sessionId={sessionId} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const group = screen.getByRole('group', { name: 'Delete agent?' });
    fireEvent.click(within(group).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('database is locked'),
    );
    expect(screen.getByRole('group', { name: 'Delete agent?' })).toBeDefined();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('closes the confirm once the agent is deleted', async () => {
    deleteAgent.mockResolvedValueOnce(undefined);
    const onDeleted = vi.fn();
    render(<AgentHeaderActions agent={agent} sessionId={sessionId} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const group = screen.getByRole('group', { name: 'Delete agent?' });
    fireEvent.click(within(group).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(screen.queryByRole('group', { name: 'Delete agent?' })).toBeNull();
  });
});
