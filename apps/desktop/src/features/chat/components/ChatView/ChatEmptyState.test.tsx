// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { ChatEmptyState } from './ChatEmptyState';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

describe('ChatEmptyState', () => {
  it('renders the fresh scenario when there is no agent and no workflow', () => {
    render(
      <ChatEmptyState
        sessionId={SESSION_ID}
        selectedAgentId={null}
        phaseRuns={[]}
        hasWorkflow={false}
      />,
    );

    screen.getByText('Populate the context');
    screen.getByRole('button', { name: /set up a workflow/i });
  });

  it('renders the workflow_no_agent scenario when a workflow exists with no agent yet', () => {
    render(
      <ChatEmptyState
        sessionId={SESSION_ID}
        selectedAgentId={null}
        phaseRuns={[]}
        hasWorkflow={true}
      />,
    );

    screen.getByText('Start the first step');
  });

  it('renders the pick_agent scenario when agents exist but none is selected', () => {
    render(
      <ChatEmptyState
        sessionId={SESSION_ID}
        selectedAgentId={null}
        phaseRuns={[anAgent({ id: AGENT_ID })]}
        hasWorkflow={false}
      />,
    );

    screen.getByText('Pick an agent');
  });

  it('reduces an agent with no messages to its kind chip, one line and a faint subline', () => {
    const { container } = render(
      <ChatEmptyState
        sessionId={SESSION_ID}
        selectedAgentId={AGENT_ID}
        phaseRuns={[anAgent({ id: AGENT_ID, name: 'Scout', kind: 'scout' })]}
        hasWorkflow={false}
      />,
    );

    expect(screen.getByText('Scout').parentElement?.querySelector('svg')).not.toBeNull();
    screen.getByText(/Reads and searches codebase/);
    screen.getByText('It shares the session brief with every other agent.');
    expect(container.querySelector('li')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
