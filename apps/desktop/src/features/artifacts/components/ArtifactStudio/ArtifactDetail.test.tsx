// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    spawnWireframeAgent: vi.fn(async () => 'agent-3'),
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

const wireframeDocument = {
  version: 1,
  initialScreenId: 'inbox',
  theme: { name: 'goodboy', font: 'sans', radius: 'md', sources: [] },
  mockState: {},
  screens: [
    {
      id: 'inbox',
      title: 'Inbox',
      viewport: 'desktop',
      root: {
        id: 'inbox-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'inbox-heading', kind: 'text', text: 'Inbox', variant: 'title' }],
      },
    },
  ],
  transitions: [],
};

const wireframe = {
  id: 'artifact-wireframe',
  sessionId: 'sess-1',
  agentId: 'agent-wireframe-1',
  workflowRunId: null,
  kind: 'wireframe',
  schemaVersion: 1,
  title: 'Settlement review flow',
  sourceFormat: 'json',
  sourceText: JSON.stringify(wireframeDocument),
  metadata: { fidelity: 'low', designProfile: {} },
  status: 'active',
  revision: 1,
  sourceTurnId: 'run-2',
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: '2026-01-02T03:04:05.000Z',
} as unknown as SessionArtifact;

const wireframer = {
  id: 'agent-wireframe-1',
  sessionId: 'sess-1',
  ordinal: 2,
  name: 'Low fidelity',
  status: 'completed',
} as unknown as Agent;

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
  state.spawnWireframeAgent.mockClear();
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
    expect(screen.getByTestId('create-report-cta').getAttribute('title')).toBe(
      'create another from this workflow run',
    );
  });
});

describe('ArtifactDetail header', () => {
  it('carries identity, sections and exports on one band', () => {
    renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    const band = screen.getByTestId('artifact-title').parentElement;
    expect(band?.contains(screen.getByRole('tab', { name: 'Artifact' }))).toBe(true);
    expect(band?.contains(screen.getByTestId('artifact-export-slot'))).toBe(true);
    expect(band?.contains(screen.getByTestId('artifact-details-toggle'))).toBe(true);
  });

  it('spends no resting width on the agent that produced the artifact', () => {
    renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    expect(screen.queryByTestId('artifact-creator')).toBeNull();
    fireEvent.click(screen.getByTestId('artifact-details-toggle'));
    const creator = screen.getByTestId('artifact-creator');
    expect(creator.textContent).toBe('Session summary');
    expect(screen.getByTestId('artifact-title').parentElement?.contains(creator)).toBe(false);
  });

  it('folds the rest of the metadata behind a disclosure', () => {
    renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    const toggle = screen.getByTestId('artifact-details-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('rev 2')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('rev 2')).toBeDefined();
    expect(screen.getByText('standalone')).toBeDefined();
  });

  it('keeps the export status out of the button flow', () => {
    renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    const controls = screen.getByTestId('artifact-export-controls');
    const status = screen.getByTestId('artifact-export-status');
    expect(controls.contains(status)).toBe(false);
    expect(status.className).toContain('w-40');
    expect(status.className).toContain('truncate');
    expect(controls.querySelectorAll('button')).toHaveLength(3);
  });

  it('leaves one label treatment per control in the conversation dock', () => {
    renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    fireEvent.click(screen.getByRole('tab', { name: 'Conversation' }));
    expect(screen.queryByText('create another from this')).toBeNull();
    expect(screen.getByTestId('artifact-attach').textContent).toContain('Attach report');
    expect(screen.getByTestId('create-report-cta').textContent).toContain('Create report');
  });

  it('keeps the follow up note on one line beside the recipient', () => {
    renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    fireEvent.click(screen.getByRole('tab', { name: 'Conversation' }));
    const note = screen.getByText(/does not rewrite this artifact/i);
    const recipient = screen.getByTestId('artifact-conversation-recipient');
    expect(note.parentElement).toBe(recipient.parentElement);
    expect(note.className).toContain('truncate');
  });
});

describe('ArtifactDetail wireframe actions', () => {
  it('carries the variant action in the identity band, not in the canvas toolbar', () => {
    renderDetail({ artifact: wireframe, agents: [wireframer] });
    const band = screen.getByTestId('artifact-title').parentElement;
    const convert = screen.getByTestId('wireframe-convert-fidelity');
    expect(band?.contains(convert)).toBe(true);
    expect(screen.getByTestId('wireframe-toolbar').contains(convert)).toBe(false);
  });

  it('keeps a label on the variant action and names the variant in its tooltip', () => {
    renderDetail({ artifact: wireframe, agents: [wireframer] });
    const convert = screen.getByTestId('wireframe-convert-fidelity');
    expect(convert.textContent).toContain('New variant');
    expect(convert.getAttribute('title')).toContain('repository styled variant');
    expect(convert.getAttribute('title')).toContain('leaving this one untouched');
  });

  it('spawns the other fidelity as a separate artifact', async () => {
    renderDetail({ artifact: wireframe, agents: [wireframer] });
    fireEvent.click(screen.getByTestId('wireframe-convert-fidelity'));
    await waitFor(() => {
      expect(state.spawnWireframeAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        fidelity: 'high',
        target: 'desktop',
        workflowRunId: null,
        attachments: [],
      });
    });
  });

  it('leaves a report without a variant action', () => {
    renderDetail({ artifact: report, agents: [reporter, otherReporter] });
    expect(screen.queryByTestId('wireframe-convert-fidelity')).toBeNull();
  });
});
