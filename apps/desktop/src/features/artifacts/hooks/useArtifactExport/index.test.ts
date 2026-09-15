// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReportArtifact } from '@goodboy/types';

const { saveSpy, exportSpy, windowSpy, onceSpy } = vi.hoisted(() => ({
  saveSpy: vi.fn(async (): Promise<string | null> => '/tmp/report.md'),
  exportSpy: vi.fn(async (_args: unknown) => '/tmp/report.md'),
  windowSpy: vi.fn((_args: unknown) => undefined),
  onceSpy: vi.fn((_event: string) => undefined),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ save: () => saveSpy() }));
vi.mock('../../artifactFile', () => ({
  exportArtifactToFile: (args: unknown) => exportSpy(args as never),
}));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: class {
    constructor(label: string, options: unknown) {
      windowSpy({ label, options });
    }
    once(event: string, handler: (payload: { payload: unknown }) => void) {
      onceSpy(event);
      if (event === 'tauri://created') {
        handler({ payload: null });
      }
      return Promise.resolve(() => undefined);
    }
  },
}));

import { useArtifactExport } from './index';

const artifact = JSON.parse(
  JSON.stringify({
    id: 'report-1',
    sessionId: 'session-1',
    agentId: 'agent-1',
    workflowRunId: null,
    kind: 'report',
    schemaVersion: 1,
    title: 'Session report: week one',
    sourceFormat: 'markdown',
    sourceText: '# Outcome',
    metadata: { reportType: 'session-summary' },
    status: 'active',
    revision: 1,
    sourceTurnId: null,
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
  }),
) as ReportArtifact;

const writeText = vi.fn(async () => undefined);

afterEach(cleanup);

describe('useArtifactExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('copies the markdown source to the clipboard', async () => {
    const { result } = renderHook(() => useArtifactExport({ artifact }));
    await act(async () => {
      await result.current.copyMarkdown();
    });
    expect(writeText).toHaveBeenCalledWith('# Outcome');
    expect(result.current.status).toEqual({ kind: 'copied' });
  });

  it('saves the markdown through the narrow writer with a slugged default name', async () => {
    const { result } = renderHook(() => useArtifactExport({ artifact }));
    await act(async () => {
      await result.current.saveMarkdown();
    });
    expect(exportSpy).toHaveBeenCalledWith({ path: '/tmp/report.md', contents: '# Outcome' });
    expect(result.current.status).toEqual({ kind: 'saved', path: '/tmp/report.md' });
  });

  it('reports a cancelled save without writing anything', async () => {
    saveSpy.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useArtifactExport({ artifact }));
    await act(async () => {
      await result.current.saveMarkdown();
    });
    expect(exportSpy).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: 'cancelled' });
  });

  it('surfaces a write failure instead of throwing', async () => {
    exportSpy.mockRejectedValueOnce(new Error('the destination folder does not exist'));
    const { result } = renderHook(() => useArtifactExport({ artifact }));
    await act(async () => {
      await result.current.saveMarkdown();
    });
    await waitFor(() => {
      expect(result.current.status).toEqual({
        kind: 'failed',
        action: 'markdown',
        message: 'the destination folder does not exist',
      });
    });
  });

  it('opens a print window pointed at the print route', async () => {
    const { result } = renderHook(() => useArtifactExport({ artifact }));
    await act(async () => {
      await result.current.savePdf();
    });
    const call = windowSpy.mock.calls[0]?.[0] as {
      readonly label: string;
      readonly options: { readonly url: string };
    };
    expect(call.label.startsWith('win-print-')).toBe(true);
    expect(call.options.url).toBe('index.html#print=artifact&session=session-1&artifact=report-1');
    expect(result.current.status).toEqual({ kind: 'printing' });
  });

  it('refuses PDF for a non markdown artifact', () => {
    const wireframe = { ...artifact, sourceFormat: 'json' } as unknown as ReportArtifact;
    const { result } = renderHook(() => useArtifactExport({ artifact: wireframe }));
    expect(result.current.canSavePdf).toBe(false);
  });
});
