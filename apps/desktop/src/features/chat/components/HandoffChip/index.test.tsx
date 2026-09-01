// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

const { extractHandoffMock, showToast, state } = vi.hoisted(() => ({
  extractHandoffMock: vi.fn<(text: string) => unknown>(() => null),
  showToast: vi.fn<(kind: string, message: string, opts?: ToastOptions) => void>(),
  state: {
    sessions: [{ id: 'sess-1', workflowRuns: [] as ReadonlyArray<string> }],
    sessionNudges: {} as Record<string, unknown>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<Agent>>,
    agentTurnState: {} as Record<string, unknown>,
    spawnAgent: vi.fn(async () => 'agent-impl' as AgentId),
    acceptSessionNudgeHandoff: vi.fn(async () => 'agent-accepted' as AgentId),
    selectAgent: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
  },
}));

vi.mock('@goodboy/core', () => ({ extractHandoff: extractHandoffMock }));
vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

import { HandoffChip } from './index';

const SESSION_ID = 'sess-1' as SessionId;
const SOURCE_AGENT_ID = 'agent-source' as AgentId;

beforeEach(() => {
  extractHandoffMock.mockReset();
  showToast.mockClear();
  state.sessions = [{ id: 'sess-1', workflowRuns: [] }];
  state.sessionNudges = {};
  state.sessionPhaseRuns = {};
  state.agentTurnState = {};
  state.spawnAgent = vi.fn(async () => 'agent-impl' as AgentId);
  state.acceptSessionNudgeHandoff = vi.fn(async () => 'agent-accepted' as AgentId);
  state.selectAgent = vi.fn(async () => undefined);
  state.setCurrentSession = vi.fn(async () => undefined);
  state.setActiveLens = vi.fn();
});
afterEach(cleanup);

describe('HandoffChip', () => {
  it('renders nothing when no handoff is detected', () => {
    extractHandoffMock.mockReturnValue(null);
    const { container } = render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the session belongs to a workflow', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: 'r' });
    state.sessions = [{ id: 'sess-1', workflowRuns: ['w'] }];
    const { container } = render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('links a directly spawned agent to the source without stealing focus', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: null });
    render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Spawn implementer' }));
    expect(state.spawnAgent).toHaveBeenCalledWith('sess-1', {
      kindOverride: 'implementer',
      parentAgentId: SOURCE_AGENT_ID,
      focus: 'none',
    });
  });

  it('shows a matching child live status and removes the spawn action', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: 'Build it' });
    state.sessionPhaseRuns = {
      'sess-1': [
        {
          id: 'agent-impl' as AgentId,
          sessionId: SESSION_ID,
          ordinal: 1,
          name: 'Implement the handoff',
          status: 'running',
          kind: 'implementer',
          parentAgentId: SOURCE_AGENT_ID,
        } as Agent,
      ],
    };

    render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );

    expect(screen.getByText('running')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go to chat' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Spawn implementer' })).toBeNull();
  });

  it('disables the action while the spawned child is waiting to enter the store', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: null });
    state.spawnAgent = vi.fn(
      () =>
        new Promise<AgentId>(() => {
          return undefined;
        }),
    );
    render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );
    const action = screen.getByRole('button', { name: 'Spawn implementer' });

    fireEvent.click(action);
    fireEvent.click(action);

    expect(screen.getByRole('button', { name: 'Spawning implementer' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(state.spawnAgent).toHaveBeenCalledOnce();
  });

  it('accepts the live nudge, reports it started, and opens the agent only from the toast', async () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: null });
    state.sessionNudges = {
      'sess-1': {
        id: 'nudge-1',
        kind: 'handoff-suggested',
        agentId: SOURCE_AGENT_ID,
        targetKind: 'implementer',
      },
    };
    render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Spawn implementer' }));

    await waitFor(() => expect(state.acceptSessionNudgeHandoff).toHaveBeenCalledWith('sess-1'));
    await waitFor(() => expect(showToast).toHaveBeenCalledOnce());
    expect(state.spawnAgent).not.toHaveBeenCalled();
    expect(state.selectAgent).not.toHaveBeenCalled();
    const opts = showToast.mock.calls[0]![2];
    expect(opts?.action?.label).toBe('Open the agent');

    opts?.action?.onClick();

    await waitFor(() => expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-accepted'));
    expect(state.setActiveLens).toHaveBeenCalledWith('sess-1', 'agents');
  });
});
