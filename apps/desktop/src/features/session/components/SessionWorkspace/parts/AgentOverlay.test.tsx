// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';

const storeState: { sessionPhaseRuns: Record<string, ReadonlyArray<unknown>> } = {
  sessionPhaseRuns: {},
};

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));
vi.mock('../../AgentDetailPane', () => ({
  AgentDetailPane: () => {
    const [isBriefOpen, setIsBriefOpen] = useState(false);
    return (
      <button type="button" onClick={() => setIsBriefOpen(true)}>
        {isBriefOpen ? 'brief open' : 'brief closed'}
      </button>
    );
  },
}));
import { AgentOverlay } from './AgentOverlay';

const session = aSession();
const sessionId: SessionId = session.id;
const first = anAgent({ id: brandId<AgentId>({ value: 'agent-1' }), sessionId });
const second = anAgent({ id: brandId<AgentId>({ value: 'agent-2' }), sessionId });

afterEach(() => {
  cleanup();
  storeState.sessionPhaseRuns = {};
});

describe('AgentOverlay', () => {
  it('keeps the skeleton while the session agents are still loading', () => {
    render(
      <AgentOverlay
        session={session}
        sessionId={sessionId}
        isChatActive={false}
        selectedAgentId={first.id}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByText('This agent is no longer in this session')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId('agent-header-title-row')).toBeDefined();
  });

  it('offers a way back when the loaded session no longer has the agent', () => {
    storeState.sessionPhaseRuns = { [sessionId]: [] };
    const onBack = vi.fn();
    render(
      <AgentOverlay
        session={session}
        sessionId={sessionId}
        isChatActive={false}
        selectedAgentId={first.id}
        onBack={onBack}
      />,
    );

    expect(screen.getByText('This agent is no longer in this session')).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId('agent-header-title-row')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('starts the next agent with a closed brief and no leftover edit', () => {
    storeState.sessionPhaseRuns = { [sessionId]: [first, second] };
    const view = (selectedAgentId: AgentId) => (
      <AgentOverlay
        session={session}
        sessionId={sessionId}
        isChatActive={false}
        selectedAgentId={selectedAgentId}
        onBack={vi.fn()}
      />
    );
    const { rerender } = render(view(first.id));
    fireEvent.click(screen.getByRole('button', { name: 'brief closed' }));
    screen.getByRole('button', { name: 'brief open' });

    rerender(view(second.id));

    screen.getByRole('button', { name: 'brief closed' });
  });
});
