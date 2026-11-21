// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReportArtifact, SessionId, WorkspaceId } from '@goodboy/types';

const { openSpy, revealSpy, locateSpy } = vi.hoisted(() => ({
  openSpy: vi.fn(async (_args: unknown) => undefined),
  revealSpy: vi.fn(async (_args: unknown) => undefined),
  locateSpy: vi.fn(async (_args: unknown) => ({ path: '/mirror/report', exists: true })),
}));

vi.mock('../../artifactMirror/artifactMirrorInvoke', () => ({
  revealArtifactMirror: (args: unknown) => revealSpy(args),
  locateArtifactMirror: (args: unknown) => locateSpy(args),
}));

vi.mock('../../artifactActionRuns', () => ({
  openArtifactCopy: (args: unknown) => openSpy(args),
}));

import { useAppStore } from '../../../../store';
import type { ReportErrorParams } from '../../../../store/slices/notifications/reportError';
import { useArtifactSavedCopy } from './index';

const COMMAND = { metaKey: true, ctrlKey: false };
const sessionId = 'session-1' as SessionId;
const workspaceId = 'workspace-1' as WorkspaceId;

const reportSpy = vi.fn(async (_params: ReportErrorParams) => undefined);

const artifact = {
  id: 'report-1',
  sessionId,
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Rounding drift',
  sourceFormat: 'markdown',
  sourceText: 'text',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T10:00:00.000Z',
} as unknown as ReportArtifact;

afterEach(cleanup);

describe('useArtifactSavedCopy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      sessions: [{ id: sessionId, workspaceId } as never],
      workspaces: [{ id: workspaceId, slug: 'harborline' } as never],
      reportError: reportSpy,
    });
  });

  it('opens the saved copy with the click it was pressed with', async () => {
    const { result } = renderHook(() => useArtifactSavedCopy({ sessionId, artifact }));
    await waitFor(() => {
      expect(result.current.location?.exists).toBe(true);
    });
    result.current.openInBrowser({ event: COMMAND });
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith({
        artifact,
        workspaceSlug: 'harborline',
        event: COMMAND,
      });
    });
  });

  it('logs a failure to open with Retry that opens it again', async () => {
    openSpy.mockRejectedValueOnce(new Error('the file is not on disk yet'));
    const { result } = renderHook(() => useArtifactSavedCopy({ sessionId, artifact }));
    result.current.openInBrowser({ event: COMMAND });
    await waitFor(() => expect(reportSpy).toHaveBeenCalledOnce());
    const reported = reportSpy.mock.calls[0]?.[0];
    expect(reported?.title).toBe("Couldn't open Rounding drift in the browser");
    expect(await reported?.retry?.()).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(2);
  });

  it('logs a failure to show the folder with Retry that shows it again', async () => {
    revealSpy.mockRejectedValueOnce(new Error('the folder moved'));
    const { result } = renderHook(() => useArtifactSavedCopy({ sessionId, artifact }));
    result.current.reveal();
    await waitFor(() => expect(reportSpy).toHaveBeenCalledOnce());
    const reported = reportSpy.mock.calls[0]?.[0];
    expect(reported?.title).toBe("Couldn't show Rounding drift in its folder");
    expect(await reported?.retry?.()).toBe(true);
    expect(revealSpy).toHaveBeenCalledTimes(2);
  });
});
