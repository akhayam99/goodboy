// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { anAgent, aSession, aWorkflowRun } from '@goodboy/types/testing';

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

const { extractHandoffMock, showToast, state } = vi.hoisted(() => {
  const sessions: ReturnType<typeof aSession>[] = [];
  return {
    extractHandoffMock: vi.fn<(text: string) => unknown>(() => null),
    showToast:
      vi.fn<(params: { readonly kind: string; readonly message: string } & ToastOptions) => void>(),
    state: {
      sessions,
      sessionNudges: {} as Record<string, unknown>,
      sessionPhaseRuns: {} as Record<string, ReadonlyArray<Agent>>,
      agentTurnState: {} as Record<string, unknown>,
      spawnAgent: vi.fn(async () => 'agent-impl' as AgentId),
      acceptSessionNudgeHandoff: vi.fn(async () => 'agent-accepted' as AgentId),
      navigate: vi.fn(),
      loadAgentTranscript: vi.fn(async () => undefined),
      providers: [
        { id: 'anthropic', connection: 'connected' },
        { id: 'cursor', connection: 'connected' },
      ],
    },
  };
});

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, extractHandoff: extractHandoffMock };
});
vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../store/slices/agents/selectKindRouting', () => ({
  selectKindRouting: () => ({ provider: 'cursor', model: 'composer-2.5', effort: 'medium' }),
}));
vi.mock('../../../../shared/components/RoutingPicker', () => ({
  RoutingPicker: ({
    ariaLabel,
    provider,
    model,
    onProvider,
  }: {
    readonly ariaLabel: string;
    readonly provider: string;
    readonly model: string;
    readonly onProvider: (provider: string) => void;
  }) => (
    <button type="button" aria-label={ariaLabel} onClick={() => onProvider('anthropic')}>
      {`${provider} ${model}`}
    </button>
  ),
}));

vi.mock('../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

import { HandoffChip } from './index';

const SESSION_ID = 'sess-1' as SessionId;
const SOURCE_AGENT_ID = 'agent-source' as AgentId;

beforeEach(() => {
  extractHandoffMock.mockReset();
  showToast.mockClear();
  state.sessions = [aSession({ id: SESSION_ID })];
  state.sessionNudges = {};
  state.sessionPhaseRuns = {};
  state.agentTurnState = {};
  state.spawnAgent = vi.fn(async () => 'agent-impl' as AgentId);
  state.acceptSessionNudgeHandoff = vi.fn(async () => 'agent-accepted' as AgentId);
  state.navigate = vi.fn();
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
    state.sessions = [aSession({ id: SESSION_ID, workflowRuns: [aWorkflowRun()] })];
    const { container } = render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('links a directly spawned agent to the source without stealing focus', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: '' });
    render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start implementer' }));
    expect(state.spawnAgent).toHaveBeenCalledWith('sess-1', {
      kindOverride: 'implementer',
      parentAgentId: SOURCE_AGENT_ID,
      focus: 'none',
      initialPrompt: 'Follow-up from the previous agent.\n\nWhat the previous agent found:\n\nx',
      provider: 'cursor',
      model: 'composer-2.5',
      effort: 'medium',
    });
  });

  it('seeds the kickoff with the reason and starts on the routing the user picked', () => {
    extractHandoffMock.mockReturnValue({ kind: 'debugger', reason: 'Router keeps a stale path' });
    state.sessionPhaseRuns = {
      'sess-1': [anAgent({ id: SOURCE_AGENT_ID, name: 'stash check', status: 'completed' })],
    };
    render(
      <HandoffChip
        assistantText={'The router is stale.\n<<handoff kind=debugger reason="x">>'}
        sessionId={SESSION_ID}
        sourceAgentId={SOURCE_AGENT_ID}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Debugger routing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start debugger' }));

    const args = (
      state.spawnAgent.mock.calls[0] as ReadonlyArray<unknown> | undefined
    )?.[1] as Record<string, unknown>;
    expect(args.provider).toBe('anthropic');
    expect(args.model).not.toBe('composer-2.5');
    expect(args.initialPrompt).toBe(
      'Follow-up from stash check: Router keeps a stale path\n\nWhat stash check found:\n\nThe router is stale.',
    );
  });

  it('shows a matching child live status and removes the spawn action', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: 'Build it' });
    state.sessionPhaseRuns = {
      'sess-1': [
        anAgent({
          id: 'agent-impl' as AgentId,
          sessionId: SESSION_ID,
          ordinal: 1,
          name: 'Implement the handoff',
          status: 'running',
          kind: 'implementer',
          parentAgentId: SOURCE_AGENT_ID,
        }),
      ],
    };

    render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );

    expect(screen.getByText('running')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go to chat' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start implementer' })).toBeNull();
  });

  it('disables the action while the spawned child is waiting to enter the store', () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: '' });
    state.spawnAgent = vi.fn(
      () =>
        new Promise<AgentId>(() => {
          return undefined;
        }),
    );
    render(
      <HandoffChip assistantText="x" sessionId={SESSION_ID} sourceAgentId={SOURCE_AGENT_ID} />,
    );
    const action = screen.getByRole('button', { name: 'Start implementer' });

    fireEvent.click(action);
    fireEvent.click(action);

    expect(screen.getByRole('button', { name: 'Starting implementer' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(state.spawnAgent).toHaveBeenCalledOnce();
  });

  it('accepts the live nudge, reports it started, and opens the agent only from the toast', async () => {
    extractHandoffMock.mockReturnValue({ kind: 'implementer', reason: '' });
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
    fireEvent.click(screen.getByRole('button', { name: 'Start implementer' }));

    await waitFor(() =>
      expect(state.acceptSessionNudgeHandoff).toHaveBeenCalledWith('sess-1', {
        routing: { provider: 'cursor', model: 'composer-2.5', effort: 'medium' },
        initialPrompt: 'Follow-up from the previous agent.\n\nWhat the previous agent found:\n\nx',
      }),
    );
    await waitFor(() => expect(showToast).toHaveBeenCalledOnce());
    expect(state.spawnAgent).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
    const opts = showToast.mock.calls[0]![0];
    expect(opts?.action?.label).toBe('Open the agent');

    opts?.action?.onClick();

    await waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: { at: 'agent', sessionId: 'sess-1', agentId: 'agent-accepted' },
      }),
    );
  });
});
