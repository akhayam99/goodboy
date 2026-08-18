// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';

const state = vi.hoisted(() => ({
  agentKindOverride: {},
  agentProviderOverride: {},
  agentModelOverride: {},
  agentEffortOverride: {},
  agentTurnState: {},
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
}));

vi.mock('../../hooks/useAgentMetrics', () => ({
  useAgentMetrics: () => ({
    latestTelemetryByAgentId: new Map(),
    aggregatesByAgentId: new Map(),
    providerUsageByAgentId: new Map(),
    turnsByAgentId: new Map(),
  }),
}));

vi.mock('../../../chat/components/ChatView', () => ({
  ChatView: () => <div>Transcript body</div>,
}));
vi.mock('./AgentBrief', () => ({ AgentBrief: () => <div>Brief body</div> }));
vi.mock('../AgentHeaderActions', () => ({ AgentHeaderActions: () => null }));
vi.mock('../ResolverDetailPane', () => ({ ResolverDetailPane: () => <div>Resolver body</div> }));

import { AgentDetailPane } from './index';

const sessionId = 'session-1' as SessionId;
const agentId = 'agent-1' as AgentId;
const session = { id: sessionId } as Session;
const agent = {
  id: agentId,
  sessionId,
  ordinal: 0,
  name: 'Implement chat',
  status: 'running',
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
  });
});

describe('AgentDetailPane', () => {
  it('opens on the brief and keeps transcript one tab away', () => {
    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    expect(screen.getByText('Brief body')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    expect(screen.getByText('Transcript body')).toBeDefined();
  });

  it('gives a resolver its resolve surface instead of the generic brief', () => {
    const resolver = { ...agent, id: 'resolver-1' as AgentId, kind: 'resolver' } satisfies Agent;

    render(
      <AgentDetailPane session={session} agent={resolver} isChatActive onBack={() => undefined} />,
    );

    expect(screen.getByText('Resolver body')).toBeDefined();
    expect(screen.queryByText('Brief body')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Brief' })).toBeNull();
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

  it('reveals the transcript without changing the selected agent', () => {
    render(
      <AgentDetailPane session={session} agent={agent} isChatActive onBack={() => undefined} />,
    );

    act(() => window.dispatchEvent(new CustomEvent('goodboy:reveal-chat')));

    expect(screen.getByText('Transcript body')).toBeDefined();
    expect(screen.getByText('Implement chat')).toBeDefined();
  });
});
