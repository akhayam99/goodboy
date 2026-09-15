// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    transcripts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    updateArtifactSource: vi.fn(async () => undefined),
    spawnReportAgent: vi.fn(async () => 'agent-report'),
    selectAgent: vi.fn(async () => undefined),
    setFocusedPlanId: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { ReportStudio } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-1'));

const report = {
  id: 'report-1',
  sessionId: SESSION_ID,
  agentId: 'agent-report',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Session report',
  sourceFormat: 'markdown',
  sourceText: '# Outcome\n\nagent-1 shipped it.\n\n## Risks\n\nnone.',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: 'run-1',
  createdAt: '2026-09-15T10:00:00.000Z',
  updatedAt: '2026-09-15T10:00:00.000Z',
};

const agents = [
  { id: 'agent-report', sessionId: SESSION_ID, ordinal: 1, name: 'reporter', status: 'completed' },
  { id: 'agent-1', sessionId: SESSION_ID, ordinal: 0, name: 'implementer', status: 'completed' },
];

const renderStudio = () =>
  render(
    <ReportStudio
      sessionId={SESSION_ID}
      artifact={JSON.parse(JSON.stringify(report))}
      agents={JSON.parse(JSON.stringify(agents))}
      artifacts={[JSON.parse(JSON.stringify(report))]}
    />,
  );

afterEach(cleanup);

describe('ReportStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.transcripts = {
      'agent-report': [{ kind: 'user_text', runId: 'r0', text: 'the original pack', at: '' }],
    };
  });

  it('renders the heading outline beside the readable body', () => {
    renderStudio();
    const outline = screen.getByRole('navigation', { name: 'Report outline' });
    expect([...outline.querySelectorAll('button')].map((node) => node.textContent)).toEqual([
      'Outcome',
      'Risks',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Outcome' })).toBeDefined();
  });

  it('links a cited source id back to its agent', () => {
    renderStudio();
    fireEvent.click(screen.getByRole('button', { name: 'implementer' }));
    expect(state.selectAgent).toHaveBeenCalledWith(SESSION_ID, 'agent-1');
  });

  it('saves an edited source, which bumps the revision in the store', async () => {
    renderStudio();
    fireEvent.click(screen.getByRole('tab', { name: /Edit/ }));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '# Rewritten' } });
    fireEvent.click(screen.getByRole('tab', { name: /Preview/ }));
    await waitFor(() => {
      expect(state.updateArtifactSource).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        artifactId: 'report-1',
        title: 'Session report',
        sourceFormat: 'markdown',
        sourceText: '# Rewritten',
        metadata: { reportType: 'session-summary' },
      });
    });
  });

  it('regenerates against the original evidence pack', async () => {
    renderStudio();
    fireEvent.click(screen.getByTestId('report-regenerate'));
    await waitFor(() => {
      expect(state.spawnReportAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        reportType: 'session-summary',
        workflowRunId: null,
        evidence: 'the original pack',
      });
    });
  });

  it('shows a regenerate failure inline', async () => {
    state.spawnReportAgent.mockRejectedValueOnce(new Error('no provider connected'));
    renderStudio();
    fireEvent.click(screen.getByTestId('report-regenerate'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('no provider connected');
    });
  });
});
