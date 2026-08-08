// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    agentKindOverride: {} as Record<string, string>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { ChatEmptyState } from './ChatEmptyState';

afterEach(() => {
  cleanup();
});

describe('ChatEmptyState', () => {
  it('renders the fresh scenario when there is no agent and no workflow', () => {
    render(
      <ChatEmptyState
        sessionId={'session-1' as SessionId}
        selectedAgentId={null}
        phaseRuns={[]}
        hasWorkflow={false}
      />,
    );

    expect(screen.getByText('Populate the context')).not.toBeNull();
    expect(screen.getByRole('button', { name: /set up a workflow/i })).not.toBeNull();
  });

  it('renders the workflow_no_agent scenario when a workflow exists with no agent yet', () => {
    render(
      <ChatEmptyState
        sessionId={'session-1' as SessionId}
        selectedAgentId={null}
        phaseRuns={[]}
        hasWorkflow={true}
      />,
    );

    expect(screen.getByText('Start the first step')).not.toBeNull();
  });

  it('renders the pick_agent scenario when agents exist but none is selected', () => {
    render(
      <ChatEmptyState
        sessionId={'session-1' as SessionId}
        selectedAgentId={null}
        phaseRuns={[{ id: 'agent-1' as AgentId } as never]}
        hasWorkflow={false}
      />,
    );

    expect(screen.getByText('Pick an agent')).not.toBeNull();
  });
});
