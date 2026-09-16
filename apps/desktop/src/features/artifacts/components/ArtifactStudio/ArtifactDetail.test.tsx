// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, SessionArtifact, SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessions: [{ id: 'sess-1' }] as ReadonlyArray<{ readonly id: string }>,
    currentSessionId: 'sess-1' as string | null,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionArtifacts: {} as Record<string, ReadonlyArray<unknown>>,
    agentTurnState: {} as Record<string, { readonly kind: string }>,
    summarizerStatus: {} as Record<string, { readonly status: string }>,
    transcripts: {} as Record<string, ReadonlyArray<unknown>>,
    agentDraft: {} as Record<string, string>,
    setAgentDraft: vi.fn(),
    openArtifactConversation: vi.fn(),
    closeArtifactConversation: vi.fn(),
    selectAgent: vi.fn(async () => undefined),
    spawnReportAgent: vi.fn(async () => 'agent-2'),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../chat/components/ChatView', () => ({
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

const otherReport = {
  ...report,
  id: 'artifact-report-2',
  agentId: 'agent-report-2',
  title: 'Northwind migration report',
} as unknown as SessionArtifact;

const reporter = {
  id: 'agent-report-1',
  sessionId: 'sess-1',
  ordinal: 1,
  name: 'Session summary',
  status: 'completed',
} as unknown as Agent;

const otherReporter = {
  ...reporter,
  id: 'agent-report-2',
  name: 'Migration summary',
} as unknown as Agent;

const stepReporter = { ...reporter, stepId: 'step-7' } as unknown as Agent;

const SESSION_ID = 'sess-1' as SessionId;

const renderDetail = ({
  artifact,
  agents,
}: {
  readonly artifact: SessionArtifact;
  readonly agents: ReadonlyArray<Agent>;
}) =>
  render(
    <ArtifactDetail
      sessionId={SESSION_ID}
      artifact={artifact}
      agents={agents}
      artifacts={[report, otherReport]}
      count={2}
      onBack={() => undefined}
      onSelectArtifact={() => undefined}
    />,
  );

beforeEach(() => {
  state.sessionPhaseRuns = { 'sess-1': [reporter, otherReporter] };
  state.sessionArtifacts = { 'sess-1': [report, otherReport] };
  state.agentTurnState = {};
  state.agentDraft = {};
  state.openArtifactConversation.mockClear();
  state.closeArtifactConversation.mockClear();
});
afterEach(cleanup);

import { ArtifactDetail } from './ArtifactDetail';

describe('ArtifactDetail tabs', () => {
  it('opens on the artifact itself', () => {
    renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    expect(screen.getByText('ledger-core shipped')).toBeDefined();
    expect(screen.queryByTestId('chat-view')).toBeNull();
    expect(state.openArtifactConversation).not.toHaveBeenCalled();
  });

  it('mounts the conversation of the agent that produced the artifact', () => {
    renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    fireEvent.click(screen.getByRole('tab', { name: 'Conversation' }));
    expect(state.openArtifactConversation).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-report-1',
    });
    expect(screen.getByTestId('chat-view')).toBeDefined();
    expect(screen.getByTestId('artifact-conversation-recipient').textContent).toContain(
      'Session summary',
    );
  });

  it('does not leave a composer pointed at the previous agent when another artifact is opened', () => {
    const view = renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    fireEvent.click(screen.getByRole('tab', { name: 'Conversation' }));
    view.rerender(
      <ArtifactDetail
        sessionId={SESSION_ID}
        artifact={otherReport}
        agents={[reporter, otherReporter]}
        artifacts={[report, otherReport]}
        count={2}
        onBack={() => undefined}
        onSelectArtifact={() => undefined}
      />,
    );
    expect(screen.queryByTestId('chat-view')).toBeNull();
    expect(state.closeArtifactConversation).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-report-1',
    });
    expect(state.openArtifactConversation).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Conversation' }));
    expect(state.openArtifactConversation).toHaveBeenLastCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-report-2',
    });
    expect(screen.getByTestId('artifact-conversation-recipient').textContent).toContain(
      'Migration summary',
    );
  });

  it('keeps step vocabulary for an artifact a workflow step produced', () => {
    renderDetail({ artifact: report, agents: [stepReporter] });
    expect(screen.getByRole('tab', { name: 'Step transcript' })).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'Conversation' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Step transcript' }));
    expect(screen.getByText('create another from this workflow run')).toBeDefined();
  });
});
