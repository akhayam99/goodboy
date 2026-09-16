// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ArtifactId, SessionId } from '@goodboy/types';

const { listSpy } = vi.hoisted(() => ({
  listSpy: vi.fn(async (_sessionId: string) => [] as ReadonlyArray<Record<string, unknown>>),
}));

vi.mock('../../../artifacts/artifacts', () => ({
  listArtifactsForSession: (sessionId: string) => listSpy(sessionId),
}));

import { ArtifactPrintView } from './index';

const request = {
  sessionId: 'session-1' as SessionId,
  artifactId: 'report-1' as ArtifactId,
};

const report = {
  id: 'report-1',
  sessionId: 'session-1',
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Session report',
  sourceFormat: 'markdown',
  sourceText: '# Outcome',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: '2026-09-15T10:00:00',
  updatedAt: '2026-09-15T10:00:00',
};

afterEach(cleanup);

describe('ArtifactPrintView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.print = vi.fn();
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => undefined) as typeof globalThis.cancelAnimationFrame;
    document.getElementById('boot-shell')?.remove();
    const shell = document.createElement('div');
    shell.id = 'boot-shell';
    document.body.append(shell);
  });

  it('removes the boot shell so the splash never prints over the document', async () => {
    listSpy.mockResolvedValueOnce([report]);
    expect(document.getElementById('boot-shell')).not.toBeNull();
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(document.getElementById('boot-shell')).toBeNull();
    });
  });

  it('drops a leading heading that repeats the title', async () => {
    listSpy.mockResolvedValueOnce([
      { ...report, sourceText: '#  session report!\n\nwhat landed this week' },
    ]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByText('what landed this week')).toBeDefined();
    });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps a leading heading that is not the title', async () => {
    listSpy.mockResolvedValueOnce([{ ...report, sourceText: '# Outcome\n\nwhat landed' }]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Outcome' })).toBeDefined();
    });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(2);
  });

  it('lays the facts out as labelled fields, with a human date and no raw timestamp', async () => {
    listSpy.mockResolvedValueOnce([report]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByText('September 15, 2026 at 10:00 AM')).toBeDefined();
    });
    expect(screen.getByText('Document').tagName).toBe('DT');
    expect(screen.getByText('Session summary').tagName).toBe('DD');
    expect(screen.getByText('Revision').tagName).toBe('DT');
    expect(screen.getByText('Prepared').tagName).toBe('DT');
    expect(document.body.textContent).not.toContain('2026-09-15T10:00:00');
  });

  it('gives a long report a contents block built from its own sections', async () => {
    listSpy.mockResolvedValueOnce([
      {
        ...report,
        sourceText: '## What shipped\n\ntext\n\n## Checks\n\ntext\n\n## Risk\n\ntext',
      },
    ]);
    render(<ArtifactPrintView request={request} />);
    const contents = await waitFor(() => screen.getByRole('navigation', { name: 'Contents' }));
    expect(contents.textContent).toContain('What shipped');
    expect(contents.textContent).toContain('Checks');
    expect(contents.textContent).toContain('Risk');
  });

  it('leaves a short report without a contents block', async () => {
    listSpy.mockResolvedValueOnce([
      { ...report, sourceText: '## Only section\n\ntext\n\n## Second\n\ntext' },
    ]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Only section' })).toBeDefined();
    });
    expect(screen.queryByRole('navigation', { name: 'Contents' })).toBeNull();
  });

  it('renders the report in a light print sheet and triggers the print dialog once', async () => {
    listSpy.mockResolvedValueOnce([report]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Session report' })).toBeDefined();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('says the source is still safe when printing is unsupported', async () => {
    listSpy.mockResolvedValueOnce([report]);
    window.print = vi.fn(() => {
      throw new Error('print is not implemented');
    });
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('could not open a print dialog');
    });
    expect(screen.getByRole('alert').textContent).toContain('nothing was lost');
  });

  it('refuses to print a json artifact instead of dumping its source', async () => {
    listSpy.mockResolvedValueOnce([
      { ...report, kind: 'wireframe', sourceFormat: 'json', sourceText: '{"screens":[]}' },
    ]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('only lays out markdown');
    });
    expect(screen.queryByText('{"screens":[]}')).toBeNull();
    expect(window.print).not.toHaveBeenCalled();
  });

  it('reports a missing artifact instead of printing an empty page', async () => {
    listSpy.mockResolvedValueOnce([]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('no longer in the session');
    });
    expect(window.print).not.toHaveBeenCalled();
  });
});
