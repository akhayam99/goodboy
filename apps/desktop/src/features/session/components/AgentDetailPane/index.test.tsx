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
  sessionOpenQuestions: {} as Record<string, ReadonlyArray<{ createdByAgentId?: string }>>,
}));

const executedRouting = vi.hoisted(() => ({
  value: null as { provider: string; model: string; effort: string | null } | null,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
  useExecutedAgentRouting: () => executedRouting.value,
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
vi.mock('../AgentHeaderActions', () => ({ AgentHeaderActions: () => null }));
vi.mock('./AgentNextAction', () => ({
  AgentNextAction: () => <div>Next action strip</div>,
}));

import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { AgentDetailPane } from './index';

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
    sessionOpenQuestions: {},
  });
  executedRouting.value = null;
  detailTime.value = undefined;
});

describe('AgentDetailPane', () => {
  it('pins the next action in the fixed header, above the tabs, on both tabs', () => {
    render(<AgentDetailPane session={session} agent={agent} isChatActive onBack={() => {}} />);

    const band = screen.getByTestId('detail-header-band');
    const strip = within(band).getByText('Next action strip');
    const tabs = within(band).getByRole('tab', { name: 'Brief' });
    expect(strip.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    expect(
      within(screen.getByTestId('detail-header-band')).getByText('Next action strip'),
    ).toBeDefined();
  });

  it('places the title at the shared detail inset above agent metadata', () => {
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

    expect(title.className).toContain('text-xl');
    expect(title.closest('.px-6')?.className).toContain('py-5');
    expect(title.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('opens on the transcript while the agent waits on an answer', () => {
    state.sessionOpenQuestions = { [session.id]: [{ createdByAgentId: agent.id }] };
    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    expect(screen.getByRole('tab', { name: 'Transcript' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('opens on the brief and keeps transcript one tab away', () => {
    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    expect(screen.getByText('Brief body')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    expect(screen.getByText('Transcript body')).toBeDefined();
  });

  it('gives a resolver the generic transcript pane so View work has a destination', () => {
    const resolver = { ...agent, id: 'resolver-1' as AgentId, kind: 'resolver' } satisfies Agent;

    render(
      <AgentDetailPane session={session} agent={resolver} isChatActive onBack={() => undefined} />,
    );

    expect(screen.getByText('Brief body')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    expect(screen.getByText('Transcript body')).toBeDefined();
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

    expect(screen.getByText('Brief body')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Brief' })).toBeDefined();
  });

  it('renders the session eyebrow above the agent title', () => {
    render(
      <AgentDetailPane
        session={session}
        agent={agent}
        isChatActive
        onBack={() => undefined}
        eyebrow={<span>Ship the lens eyebrow</span>}
      />,
    );

    const eyebrow = screen.getByText('Ship the lens eyebrow');
    const title = screen.getByRole('heading', { level: 1 });
    expect(eyebrow.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
