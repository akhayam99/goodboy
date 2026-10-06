// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';

const state = vi.hoisted(() => ({
  agentKindOverride: {},
  agentProviderOverride: {},
  agentModelOverride: {},
  agentEffortOverride: {},
  agentTurnState: {} as Record<string, { kind: string }>,
  agentPane: {} as Record<string, 'brief' | 'transcript' | null>,
  sessionOpenQuestions: {} as Record<string, ReadonlyArray<{ createdByAgentId?: string }>>,
  sessionResolveAttempts: {} as Record<string, ReadonlyArray<unknown>>,
}));

const executedRouting = vi.hoisted(() => ({
  value: null as { provider: string; model: string; effort: string | null } | null,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
  useExecutedAgentRouting: () => executedRouting.value,
  EMPTY_ARRAY: [],
}));

const detailTime = vi.hoisted(() => ({
  value: undefined as
    | {
        label: string;
        detail: string;
        progress: number | null;
        headline: string;
        note: string | null;
        isMuchLonger: boolean;
      }
    | undefined,
}));

vi.mock('../../hooks/useAgentDetailWorkTime', () => ({
  useAgentDetailWorkTime: () => detailTime.value,
}));

vi.mock('../../../chat/components/ChatView', () => ({
  ChatView: () => <div>Transcript body</div>,
}));
vi.mock('./AgentBrief', () => ({ AgentBrief: () => <div>Brief body</div> }));
vi.mock('./AgentHeaderStatus', () => ({
  AgentHeaderStatus: ({ status }: { readonly status: string }) => (
    <span>{status === 'running' ? 'Running' : status}</span>
  ),
}));
vi.mock('../AgentHeaderActions', () => ({
  AgentHeaderActions: () => <button type="button">More agent actions</button>,
}));
vi.mock('./AgentNextAction', () => ({
  AgentNextAction: () => <div>Next action strip</div>,
}));

import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { AgentDetailPane } from './index';
import { openAgentRevealEvent } from './agentOpenTab';

const sessionId = 'session-1' as SessionId;
const agentId = 'agent-1' as AgentId;
const session = { id: sessionId } as Session;
const agent = {
  id: agentId,
  sessionId,
  ordinal: 0,
  name: 'Implement chat',
  status: 'completed',
  kind: 'implementer',
} satisfies Agent;

afterEach(cleanup);

beforeEach(() => {
  Object.assign(state, {
    agentKindOverride: {},
    agentProviderOverride: {},
    agentModelOverride: {},
    agentEffortOverride: {},
    agentTurnState: {},
    agentPane: {},
    sessionOpenQuestions: {},
    sessionResolveAttempts: {},
  });
  executedRouting.value = null;
  detailTime.value = undefined;
});

describe('AgentDetailPane', () => {
  it('opens the body with the next action, below the tabs, on both tabs', () => {
    const { container } = render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => {}} />,
    );

    const header = container.querySelector('[data-slot="pane-header"]') as HTMLElement;
    const transcriptStrip = screen.getByText('Next action strip');
    const tabs = within(header).getByRole('tab', { name: 'Brief' });
    expect(header.contains(transcriptStrip)).toBe(false);
    expect(
      tabs.compareDocumentPosition(transcriptStrip) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      transcriptStrip.compareDocumentPosition(screen.getByText('Transcript body')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(tabs);
    const strip = screen.getByText('Next action strip');
    expect(header.contains(strip)).toBe(false);
    expect(
      strip.compareDocumentPosition(screen.getByText('Brief body')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('puts the title in the pane header above agent metadata', () => {
    render(
      <AgentDetailPane
        session={session}
        agent={{ ...agent, status: 'running' }}
        isChatActive
        onBack={() => undefined}
      />,
    );

    const title = screen.getByRole('heading', { level: 1, name: 'Implement chat' });
    const status = screen.getByText('Running');

    expect(title.closest('[data-slot="pane-header"]')).not.toBeNull();
    expect(title.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts role, status, time and model on one meta line under the title', () => {
    render(
      <AgentDetailPane
        session={session}
        agent={{ ...agent, status: 'running' }}
        isChatActive
        onBack={() => undefined}
      />,
    );

    const meta = screen.getByTestId('agent-header-meta');
    const title = screen.getByRole('heading', { level: 1 });

    expect(within(meta).getByText('Implementer')).toBeDefined();
    expect(within(meta).getByText('Running')).toBeDefined();
    expect(within(meta).getByText('Model not chosen yet')).toBeDefined();
    expect(title.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Brief and Transcript on the title row, before the actions', () => {
    render(
      <AgentDetailPane
        session={session}
        agent={{ ...agent, status: 'running' }}
        isChatActive
        onBack={() => undefined}
      />,
    );

    const row = screen.getByTestId('agent-header-title-row');
    const tabs = within(row).getByRole('tablist', { name: 'Agent sections' });
    const more = within(row).getByRole('button', { name: 'More agent actions' });

    expect(tabs.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens on the transcript while the agent is running', () => {
    render(
      <AgentDetailPane
        session={session}
        agent={{ ...agent, status: 'running' }}
        isChatActive
        onBack={() => undefined}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Transcript' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('opens on the brief while the agent waits on an answer', () => {
    state.sessionOpenQuestions = { [session.id]: [{ createdByAgentId: agent.id }] };
    render(
      <AgentDetailPane
        session={session}
        agent={{ ...agent, status: 'running' }}
        isChatActive
        onBack={() => undefined}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Brief' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Brief body')).toBeDefined();
  });

  it('opens on the transcript with no open question and keeps the brief one tab away', () => {
    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    expect(screen.getByText('Transcript body')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Brief' }));
    expect(screen.getByText('Brief body')).toBeDefined();
  });

  it('moves to the brief when the questions load after the pane opened', () => {
    const { rerender } = render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );
    expect(screen.getByText('Transcript body')).toBeDefined();

    state.sessionOpenQuestions = { [session.id]: [{ createdByAgentId: agent.id }] };
    rerender(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    expect(screen.getByText('Brief body')).toBeDefined();
  });

  it('keeps the brief when an agent open reveals the chat, a plain reveal still shows the transcript', () => {
    state.sessionOpenQuestions = { [session.id]: [{ createdByAgentId: agent.id }] };
    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    act(() => window.dispatchEvent(openAgentRevealEvent()));
    expect(screen.getByText('Brief body')).toBeDefined();

    act(() => window.dispatchEvent(new CustomEvent('goodboy:reveal-chat')));
    expect(screen.getByText('Transcript body')).toBeDefined();
  });

  it('gives a resolver no Fix run page of its own, only the tabs every agent has', () => {
    const resolver = { ...agent, id: 'resolver-1' as AgentId, kind: 'resolver' } satisfies Agent;
    state.sessionResolveAttempts = {
      [session.id]: [{ agentId: resolver.id, threadIds: ['thread-1'], batchId: null }],
    };

    render(
      <AgentDetailPane session={session} agent={resolver} isChatActive onBack={() => undefined} />,
    );

    expect(screen.queryByRole('tab', { name: 'Fix run' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Brief' })).toBeDefined();
    expect(screen.getByText('Transcript body')).toBeDefined();
  });

  it('opens the tab the address asks for over the default', () => {
    state.sessionOpenQuestions = { [session.id]: [{ createdByAgentId: agent.id }] };
    state.agentPane = { [session.id]: 'transcript' };

    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    expect(screen.getByText('Transcript body')).toBeDefined();
    act(() => window.dispatchEvent(openAgentRevealEvent()));
    expect(screen.getByText('Transcript body')).toBeDefined();
  });

  it('opens a plain agent on the brief when the address asks for it', () => {
    state.agentPane = { [session.id]: 'brief' };

    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    expect(screen.getByText('Brief body')).toBeDefined();
  });

  it('gives a workflow step the same brief component a standalone agent gets', () => {
    const step = {
      ...agent,
      workflowRunId: 'run-1' as Agent['workflowRunId'],
      stepId: 'step-1' as Agent['stepId'],
    } satisfies Agent;

    render(
      <AgentDetailPane session={session} agent={step} isChatActive onBack={() => undefined} />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Brief' }));
    expect(screen.getByText('Brief body')).toBeDefined();
  });

  it('renders the origin context as the first body block, below the agent title', () => {
    render(
      <AgentDetailPane
        session={session}
        agent={agent}
        isChatActive
        onBack={() => undefined}
        context={<span>Resolving thread 3</span>}
      />,
    );

    const context = screen.getByText('Resolving thread 3');
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      context.compareDocumentPosition(screen.getByText('Next action strip')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows the planned model in the header while the agent has not run', () => {
    Object.assign(state, { agentModelOverride: { [agentId]: 'claude-haiku-4-5' } });

    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    expect(document.querySelector('[data-model-id="claude-haiku-4-5"]')).not.toBeNull();
    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('shows the model that actually ran and names the plan it replaced', () => {
    Object.assign(state, { agentModelOverride: { [agentId]: 'claude-haiku-4-5' } });
    executedRouting.value = { provider: 'codex', model: 'gpt-5.1-codex', effort: null };

    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    expect(document.querySelector('[data-model-id="gpt-5.1-codex"]')).not.toBeNull();
    expect(document.querySelector('[data-model-id="claude-haiku-4-5"]')).toBeNull();
    expect(tooltipTextOf({ element: screen.getByTestId('routing-divergence') })).toContain(
      'Planned Haiku 4.5, routing picked',
    );
  });

  it('shows the effort the run was started with and marks where it left the plan', () => {
    Object.assign(state, { agentEffortOverride: { [agentId]: 'high' } });
    executedRouting.value = { provider: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' };

    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    const label = screen.getByTestId('routing-divergence');
    expect(label.querySelector('[data-routing-part="detail"]')?.textContent).toBe('Medium');
    expect(screen.queryByText('High')).toBeNull();
    expect(tooltipTextOf({ element: label })).toContain('Planned High, ran Medium');
  });

  it('reveals the transcript without changing the selected agent', () => {
    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    act(() => window.dispatchEvent(new CustomEvent('goodboy:reveal-chat')));

    expect(screen.getByText('Transcript body')).toBeDefined();
    expect(screen.getByText('Implement chat')).toBeDefined();
  });

  it('shows elapsed time and time left next to the status while running', () => {
    detailTime.value = {
      label: '~3-7m left',
      detail: 'Running 4m 12s. Usually 6-9m.',
      progress: 0.4,
      headline: '4m · ~3-7m left',
      note: null,
      isMuchLonger: false,
    };

    render(
      <AgentDetailPane
        session={session}
        agent={{ ...agent, status: 'running' }}
        isChatActive
        onBack={() => undefined}
      />,
    );

    expect(screen.getByTestId('agent-header-time').textContent).toBe('4m · ~3-7m left');
  });
});
