// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';

const { deleteAgent, setAgentDone, clearAgentDone, openQuestions } = vi.hoisted(() => ({
  deleteAgent: vi.fn(),
  setAgentDone: vi.fn(),
  clearAgentDone: vi.fn(),
  openQuestions: { list: [] as Array<{ status: string; createdByAgentId: string }> },
}));

vi.mock('../../../store', () => {
  const state = {
    setAgentDone,
    clearAgentDone,
    cancelCurrentTurn: vi.fn(),
    deleteAgent,
    agentTurnState: {},
    get sessionOpenQuestions() {
      return { 'sess-1': openQuestions.list };
    },
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
  setAgentDone.mockReset();
  clearAgentDone.mockReset();
  openQuestions.list = [];
});

const agentWith = (fields: Partial<Agent>): Agent => ({ ...agent, ...fields }) as Agent;

describe('AgentHeaderActions lifecycle', () => {
  it('offers close to a failed agent outside a workflow and closes it', () => {
    render(<AgentHeaderActions agent={agentWith({ status: 'failed' })} sessionId={sessionId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(setAgentDone).toHaveBeenCalledWith(sessionId, 'agent-1');
  });

  it('offers close to an agent waiting on its own open question', () => {
    openQuestions.list = [{ status: 'open', createdByAgentId: 'agent-1' }];
    render(<AgentHeaderActions agent={agentWith({ status: 'completed' })} sessionId={sessionId} />);

    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
  });

  it('shows no lifecycle action once an agent finished on its own', () => {
    render(<AgentHeaderActions agent={agentWith({ status: 'completed' })} sessionId={sessionId} />);

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull();
  });

  it('never offers close on a workflow step', () => {
    render(
      <AgentHeaderActions
        agent={agentWith({ status: 'failed', workflowRunId: 'run-1' as WorkflowRunId })}
        sessionId={sessionId}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('offers reopen on an agent you closed', () => {
    render(
      <AgentHeaderActions
        agent={agentWith({ status: 'failed', doneAt: '2026-09-24T10:00:00.000Z' as IsoDateTime })}
        sessionId={sessionId}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    expect(clearAgentDone).toHaveBeenCalledWith(sessionId, 'agent-1');
  });
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
