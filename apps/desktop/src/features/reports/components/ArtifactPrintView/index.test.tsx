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
  createdAt: '2026-09-15T10:00:00.000Z',
  updatedAt: '2026-09-15T10:00:00.000Z',
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

  it('reports a missing artifact instead of printing an empty page', async () => {
    listSpy.mockResolvedValueOnce([]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('no longer in the session');
    });
    expect(window.print).not.toHaveBeenCalled();
  });
});
