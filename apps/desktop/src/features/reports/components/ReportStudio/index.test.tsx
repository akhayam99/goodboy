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

const renderStudio = ({ mode }: { readonly mode: 'preview' | 'edit' }) =>
  render(
    <ReportStudio
      sessionId={SESSION_ID}
      artifact={JSON.parse(JSON.stringify(report))}
      mode={mode}
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
    renderStudio({ mode: 'preview' });
    const outline = screen.getByRole('navigation', { name: 'Report outline' });
    expect([...outline.querySelectorAll('button')].map((node) => node.textContent)).toEqual([
      'Outcome',
      'Risks',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Outcome' })).toBeDefined();
  });

  it('pins the outline rail so it survives the body scroll', () => {
    renderStudio({ mode: 'preview' });
    const rail = screen.getByTestId('report-outline-rail');
    expect(rail.className).toContain('sticky');
    expect(rail.className).toContain('top-0');
    expect(rail.className).toContain('self-start');
    expect(rail.className).toContain('overflow-y-auto');
    expect(rail.className).toContain('max-h-[60vh]');
  });

  it('spends no room on provenance or actions, which the detail band owns', () => {
    renderStudio({ mode: 'preview' });
    expect(screen.queryByTestId('report-provenance')).toBeNull();
    expect(screen.queryByTestId('report-regenerate')).toBeNull();
    expect(screen.queryByRole('tab', { name: /Preview/ })).toBeNull();
  });

  it('saves an edited source when the band leaves edit, which bumps the revision', async () => {
    const view = renderStudio({ mode: 'edit' });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '# Rewritten' } });
    view.rerender(
      <ReportStudio
        sessionId={SESSION_ID}
        artifact={JSON.parse(JSON.stringify(report))}
        mode="preview"
      />,
    );
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
        mode="preview"
      />,
    );
    const outline = screen.getByRole('navigation', { name: 'Report outline' });
    const entries = [...outline.querySelectorAll('button')];
    fireEvent.click(entries[2]!);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]).toBe(screen.getAllByRole('heading', { name: 'Risks' })[1]);
  });

  it('drops the draft of the previous report when another one is shown', () => {
    const { rerender } = renderStudio({ mode: 'edit' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Leaked edit' } });
    rerender(
      <ReportStudio
        sessionId={SESSION_ID}
        artifact={JSON.parse(
          JSON.stringify({ ...report, id: 'report-2', sourceText: '# Second report' }),
        )}
        mode="edit"
      />,
    );
    expect(screen.getByRole('textbox')).toHaveProperty('value', '# Second report');
    expect(state.updateArtifactSource).not.toHaveBeenCalled();
  });
});
