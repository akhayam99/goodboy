// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    transcripts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    updateArtifactSource: vi.fn(async () => undefined),
    spawnReportAgent: vi.fn(async () => 'agent-report'),
    selectAgent: vi.fn(async () => undefined),
  },
}));

const selectArtifact = vi.fn();

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

const plan = {
  ...report,
  id: 'plan-1',
  kind: 'plan',
  title: 'Ship the thing',
  sourceText: 'step one',
};

const renderStudio = () =>
  render(
    <ReportStudio
      sessionId={SESSION_ID}
      artifact={JSON.parse(JSON.stringify(report))}
      agents={JSON.parse(JSON.stringify(agents))}
      artifacts={[JSON.parse(JSON.stringify(report))]}
      onSelectArtifact={selectArtifact}
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

  it('links a cited source id back to its agent from a labelled chip', () => {
    renderStudio();
    const chip = screen.getByRole('button', { name: 'open the agent implementer' });
    expect(chip.getAttribute('data-testid')).toBe('report-source-chip');
    fireEvent.click(chip);
    expect(state.selectAgent).toHaveBeenCalledWith(SESSION_ID, 'agent-1');
  });

  it('collapses a long source list behind a count and expands it inline', () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      id: `agent-${index}`,
      sessionId: SESSION_ID,
      ordinal: index,
      name: `worker ${index}`,
      status: 'completed',
    }));
    render(
      <ReportStudio
        sessionId={SESSION_ID}
        artifact={JSON.parse(
          JSON.stringify({
            ...report,
            sourceText: many.map((agent) => agent.id).join(' and '),
          }),
        )}
        agents={JSON.parse(JSON.stringify(many))}
        artifacts={[]}
        onSelectArtifact={selectArtifact}
      />,
    );
    expect(screen.getAllByTestId('report-source-chip')).toHaveLength(4);
    fireEvent.click(screen.getByTestId('report-sources-more'));
    expect(screen.getAllByTestId('report-source-chip')).toHaveLength(7);
    fireEvent.click(screen.getByTestId('report-sources-less'));
    expect(screen.getAllByTestId('report-source-chip')).toHaveLength(4);
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
  it('sends a cited artifact to the studio selection, not to the plan focus', () => {
    render(
      <ReportStudio
        sessionId={SESSION_ID}
        artifact={JSON.parse(
          JSON.stringify({ ...report, sourceText: 'built on plan-1 and nothing else' }),
        )}
        agents={[]}
        artifacts={JSON.parse(JSON.stringify([report, plan]))}
        onSelectArtifact={selectArtifact}
      />,
    );
    fireEvent.click(screen.getByTestId('report-source-chip'));
    expect(selectArtifact).toHaveBeenCalledWith('plan-1');
  });

  it('scrolls to the repeated heading the reader picked, not to the first of its name', () => {
    const scrolled: Array<Element> = [];
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this);
    };
    render(
      <ReportStudio
        sessionId={SESSION_ID}
        artifact={JSON.parse(
          JSON.stringify({
            ...report,
            sourceText: '# Outcome\n\n## Risks\n\nfirst.\n\n## Risks\n\nsecond.',
          }),
        )}
        agents={[]}
        artifacts={[]}
        onSelectArtifact={selectArtifact}
      />,
    );
    const outline = screen.getByRole('navigation', { name: 'Report outline' });
    const entries = [...outline.querySelectorAll('button')];
    fireEvent.click(entries[2]!);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]).toBe(screen.getAllByRole('heading', { name: 'Risks' })[1]);
  });

  it('drops the draft of the previous report when another one is shown', () => {
    const { rerender } = renderStudio();
    fireEvent.click(screen.getByRole('tab', { name: /Edit/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Leaked edit' } });
    rerender(
      <ReportStudio
        sessionId={SESSION_ID}
        artifact={JSON.parse(
          JSON.stringify({ ...report, id: 'report-2', sourceText: '# Second report' }),
        )}
        agents={JSON.parse(JSON.stringify(agents))}
        artifacts={[]}
        onSelectArtifact={selectArtifact}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Edit/ }));
    expect(screen.getByRole('textbox')).toHaveProperty('value', '# Second report');
    expect(state.updateArtifactSource).not.toHaveBeenCalled();
  });

  it('refuses to regenerate once the evidence pack has left memory', () => {
    state.transcripts = {};
    renderStudio();
    const button = screen.getByTestId('report-regenerate');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('report-regenerate-blocked').textContent).toContain(
      'no longer in memory',
    );
    fireEvent.click(button);
    expect(state.spawnReportAgent).not.toHaveBeenCalled();
  });
});
