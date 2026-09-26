// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, Session, SessionId } from '@goodboy/types';

const storeState: { sessionPhaseRuns: Record<string, ReadonlyArray<unknown>> } = {
  sessionPhaseRuns: {},
};

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));
vi.mock('../../AgentDetailPane', () => ({
  AgentDetailPane: () => <div>agent detail</div>,
}));
import { AgentOverlay } from './AgentOverlay';

const sessionId = 'sess-1' as SessionId;
const session = { id: sessionId } as unknown as Session;

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
        selectedAgentId={'agent-1' as AgentId}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByText('This agent is no longer in this session')).toBeNull();
  });

  it('offers a way back when the loaded session no longer has the agent', () => {
    storeState.sessionPhaseRuns = { [sessionId]: [] };
    const onBack = vi.fn();
    render(
      <AgentOverlay
        session={session}
        sessionId={sessionId}
        isChatActive={false}
        selectedAgentId={'agent-1' as AgentId}
        onBack={onBack}
      />,
    );

    expect(screen.getByText('This agent is no longer in this session')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
