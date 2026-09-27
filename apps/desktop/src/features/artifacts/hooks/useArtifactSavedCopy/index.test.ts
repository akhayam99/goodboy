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
  openArtifactMirror: (args: unknown) => openSpy(args),
  revealArtifactMirror: (args: unknown) => revealSpy(args),
  locateArtifactMirror: (args: unknown) => locateSpy(args),
}));

import { useAppStore } from '../../../../store';
import { useArtifactSavedCopy } from './index';

const sessionId = 'session-1' as SessionId;
const workspaceId = 'workspace-1' as WorkspaceId;

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
    });
  });

  it('opens the mirror index file in the default browser', async () => {
    const { result } = renderHook(() => useArtifactSavedCopy({ sessionId, artifact }));
    await waitFor(() => {
      expect(result.current.location?.exists).toBe(true);
    });
    result.current.openInBrowser();
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith({
        workspaceSlug: 'harborline',
        folder: expect.stringContaining('rounding-drift'),
        file: 'index.html',
      });
    });
  });

  it('surfaces a failure to open instead of throwing', async () => {
    openSpy.mockRejectedValueOnce(new Error('the file is not on disk yet'));
    const { result } = renderHook(() => useArtifactSavedCopy({ sessionId, artifact }));
    result.current.openInBrowser();
    await waitFor(() => {
      expect(result.current.error).toBe('the file is not on disk yet');
    });
  });
});
