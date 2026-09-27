// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReportArtifact } from '@goodboy/types';

const { saveSpy, exportSpy } = vi.hoisted(() => ({
  saveSpy: vi.fn(async (_options: unknown): Promise<string | null> => '/tmp/report.md'),
  exportSpy: vi.fn(async (_args: unknown) => '/tmp/report.md'),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (options: unknown) => saveSpy(options as never),
}));
vi.mock('../../artifactFile', () => ({
  exportArtifactToFile: (args: unknown) => exportSpy(args as never),
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

const wireframe = {
  ...artifact,
  id: 'wireframe-1',
  kind: 'wireframe',
  title: 'Onboarding flow',
  sourceFormat: 'json',
  sourceText: '{"screens":[]}',
} as unknown as ReportArtifact;

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
      await result.current.copySource();
    });
    expect(writeText).toHaveBeenCalledWith('# Outcome');
    expect(result.current.status).toEqual({ kind: 'copied' });
  });

  it('saves the markdown through the narrow writer with a slugged default name', async () => {
    const { result } = renderHook(() => useArtifactExport({ artifact }));
    await act(async () => {
      await result.current.saveSource();
    });
    expect(exportSpy).toHaveBeenCalledWith({ path: '/tmp/report.md', contents: '# Outcome' });
    expect(result.current.status).toEqual({ kind: 'saved', path: '/tmp/report.md' });
  });

  it('reports a cancelled save without writing anything', async () => {
    saveSpy.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useArtifactExport({ artifact }));
    await act(async () => {
      await result.current.saveSource();
    });
    expect(exportSpy).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: 'cancelled' });
  });

  it('surfaces a write failure instead of throwing', async () => {
    exportSpy.mockRejectedValueOnce(new Error('the destination folder does not exist'));
    const { result } = renderHook(() => useArtifactExport({ artifact }));
    await act(async () => {
      await result.current.saveSource();
    });
    await waitFor(() => {
      expect(result.current.status).toEqual({
        kind: 'failed',
        action: 'source',
        message: 'the destination folder does not exist',
      });
    });
  });

  it('offers markdown affordances for a markdown artifact', () => {
    const { result } = renderHook(() => useArtifactExport({ artifact }));
    expect(result.current.sourceActionLabel).toBe('Save markdown');
  });

  it('labels the json source save as JSON and filters on the json extension', async () => {
    const { result } = renderHook(() => useArtifactExport({ artifact: wireframe }));
    expect(result.current.sourceActionLabel).toBe('Save JSON');
    await act(async () => {
      await result.current.saveSource();
    });
    expect(saveSpy).toHaveBeenCalledWith({
      defaultPath: 'onboarding-flow.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
  });

  it('copies pretty printed json for a json artifact', async () => {
    const { result } = renderHook(() => useArtifactExport({ artifact: wireframe }));
    await act(async () => {
      await result.current.copySource();
    });
    expect(writeText).toHaveBeenCalledWith('{\n  "screens": []\n}');
  });

  it('falls back to the raw source when the json does not parse', async () => {
    const broken = { ...wireframe, sourceText: '{screens' } as unknown as ReportArtifact;
    const { result } = renderHook(() => useArtifactExport({ artifact: broken }));
    await act(async () => {
      await result.current.copySource();
    });
    expect(writeText).toHaveBeenCalledWith('{screens');
  });
});
