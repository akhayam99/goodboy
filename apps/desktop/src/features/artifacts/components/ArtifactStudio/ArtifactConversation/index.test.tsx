// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, SessionArtifact, SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessions: [] as ReadonlyArray<{ readonly id: string }>,
    currentSessionId: 'sess-1' as string | null,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    agentTurnState: {} as Record<string, { readonly kind: string }>,
    summarizerStatus: {} as Record<string, { readonly status: string }>,
    agentDraft: {} as Record<string, string>,
    setAgentDraft: vi.fn(),
    openArtifactConversation: vi.fn(),
    closeArtifactConversation: vi.fn(),
    spawnReportAgent: vi.fn(async () => 'agent-2'),
    spawnWireframeAgent: vi.fn(async () => 'agent-2'),
  },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../chat/components/ChatView', () => ({
  ChatView: () => <div data-testid="chat-view" />,
}));

const report = {
  id: 'artifact-report',
  sessionId: 'sess-1',
  agentId: 'agent-report-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Harborline rollout report',
  sourceFormat: 'markdown',
  sourceText: '## outcome\nledger-core shipped',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 2,
  sourceTurnId: 'run-1',
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: '2026-01-02T03:04:05.000Z',
} as unknown as SessionArtifact;

const agent = {
  id: 'agent-report-1',
  sessionId: 'sess-1',
  ordinal: 1,
  name: 'Session summary',
  status: 'completed',
} as unknown as Agent;

const SESSION_ID = 'sess-1' as SessionId;

beforeEach(() => {
  state.sessions = [{ id: 'sess-1' }];
  state.currentSessionId = 'sess-1';
  state.sessionPhaseRuns = { 'sess-1': [agent] };
  state.agentTurnState = {};
  state.summarizerStatus = {};
  state.agentDraft = {};
  state.setAgentDraft.mockClear();
  state.openArtifactConversation.mockClear();
  state.closeArtifactConversation.mockClear();
});
afterEach(cleanup);

import { ArtifactConversation } from './index';

describe('ArtifactConversation', () => {
  it('hands the artifact workspace the conversation of the agent that produced it', () => {
    render(
      <ArtifactConversation
        sessionId={SESSION_ID}
        artifact={report}
        agent={agent}
        isWorkflowOwned={false}
      />,
    );
    expect(state.openArtifactConversation).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-report-1',
    });
    expect(screen.getByTestId('chat-view')).toBeDefined();
  });

  it('names the recipient of the composer', () => {
    render(
      <ArtifactConversation
        sessionId={SESSION_ID}
        artifact={report}
        agent={agent}
        isWorkflowOwned={false}
      />,
    );
    expect(screen.getByTestId('artifact-conversation-recipient').textContent).toContain(
      'Session summary',
    );
  });

  it('releases the conversation when the user leaves it', () => {
    const view = render(
      <ArtifactConversation
        sessionId={SESSION_ID}
        artifact={report}
        agent={agent}
        isWorkflowOwned={false}
      />,
    );
    view.unmount();
    expect(state.closeArtifactConversation).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-report-1',
    });
  });

  it('attaches the current content to the draft of that same agent', () => {
    const edited = {
      ...report,
      sourceText: '## outcome\nnotify-relay was cut',
    } as unknown as SessionArtifact;
    state.agentDraft = { 'agent-report-1': 'what changed here?' };
    render(
      <ArtifactConversation
        sessionId={SESSION_ID}
        artifact={edited}
        agent={agent}
        isWorkflowOwned={false}
      />,
    );
    fireEvent.click(screen.getByTestId('artifact-attach'));
    const [agentId, next] = state.setAgentDraft.mock.calls[0] as [string, string];
    expect(agentId).toBe('agent-report-1');
    expect(next).toContain('what changed here?');
    expect(next).toContain('notify-relay was cut');
  });

  it('says a follow up adds another output instead of rewriting the artifact', () => {
    render(
      <ArtifactConversation
        sessionId={SESSION_ID}
        artifact={report}
        agent={agent}
        isWorkflowOwned={false}
      />,
    );
    expect(screen.getByText(/does not rewrite this artifact/i)).toBeDefined();
    expect(screen.queryByText(/revision/i)).toBeNull();
    expect(screen.queryByText(/replaces this/i)).toBeNull();
  });

  it('offers creating another artifact from the same source', () => {
    render(
      <ArtifactConversation
        sessionId={SESSION_ID}
        artifact={report}
        agent={agent}
        isWorkflowOwned={false}
      />,
    );
    expect(screen.getByTestId('artifact-create-another')).toBeDefined();
    expect(screen.getByTestId('create-report-cta')).toBeDefined();
  });

  it('carries the sentence on the button instead of a caption beside it', () => {
    render(
      <ArtifactConversation
        sessionId={SESSION_ID}
        artifact={report}
        agent={agent}
        isWorkflowOwned={false}
      />,
    );
    expect(screen.queryByText('create another from this')).toBeNull();
    expect(screen.getByTestId('create-report-cta').getAttribute('title')).toBe(
      'create another from this',
    );
    expect(screen.getByTestId('artifact-attach').textContent).toContain('Attach report');
  });

  it('keeps workflow vocabulary for a workflow owned agent', () => {
    render(
      <ArtifactConversation
        sessionId={SESSION_ID}
        artifact={report}
        agent={agent}
        isWorkflowOwned
      />,
    );
    expect(screen.getByTestId('create-report-cta').getAttribute('title')).toBe(
      'create another from this workflow run',
    );
    expect(screen.getByText(/this is the step transcript/i)).toBeDefined();
    expect(screen.queryByText(/reopen/i)).toBeNull();
  });

  it('says there is nothing to talk to when the agent is gone', () => {
    render(
      <ArtifactConversation
        sessionId={SESSION_ID}
        artifact={report}
        agent={null}
        isWorkflowOwned={false}
      />,
    );
    expect(state.openArtifactConversation).not.toHaveBeenCalled();
    expect(screen.queryByTestId('chat-view')).toBeNull();
    expect(screen.getByText(/no conversation to show/i)).toBeDefined();
  });
});
