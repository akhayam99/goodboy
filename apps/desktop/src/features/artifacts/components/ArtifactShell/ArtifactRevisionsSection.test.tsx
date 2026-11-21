// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ArtifactId, IsoDateTime, ReportArtifact, SessionId } from '@goodboy/types';

const { listArtifactRevisions } = vi.hoisted(() => ({
  listArtifactRevisions: vi.fn(),
}));

vi.mock('../../artifacts', () => ({ listArtifactRevisions }));

import { useAppStore } from '../../../../store';
import type { ReportErrorParams } from '../../../../store/slices/notifications/reportError';
import { RestoreConflictError } from '../../../../store/slices/artifacts/RestoreConflictError';
import { ArtifactRevisionsSection } from './ArtifactRevisionsSection';

const SESSION_ID = 'session-1' as SessionId;
const ARTIFACT_ID = 'artifact-1' as ArtifactId;
const NOW = '2026-09-15T10:00:00.000Z' as IsoDateTime;

const artifact = {
  id: ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Session report',
  sourceFormat: 'markdown',
  sourceText: '## Outcome',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 2,
  sourceTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
} as unknown as ReportArtifact;

const revision = (over: Partial<Record<string, unknown>>) => ({
  artifactId: ARTIFACT_ID,
  revision: 1,
  title: 'Session report',
  sourceText: '## Outcome',
  metadata: { reportType: 'session-summary' },
  author: 'agent',
  ask: null,
  pinned: null,
  summary: null,
  createdAt: NOW,
  ...over,
});

const restoreSpy = vi.fn(async (_params: unknown) => undefined);

const reportSpy = vi.fn(async (_params: ReportErrorParams) => undefined);

afterEach(cleanup);

describe('ArtifactRevisionsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      restoreArtifactRevision: restoreSpy,
      reportError: reportSpy,
    } as never);
  });

  it('shows nothing when the artifact has only ever had one revision', async () => {
    listArtifactRevisions.mockResolvedValueOnce([revision({ revision: 1 })]);
    render(
      <ArtifactRevisionsSection sessionId={SESSION_ID} artifact={artifact} creatorName="Scout" />,
    );
    await waitFor(() => expect(listArtifactRevisions).toHaveBeenCalledWith(ARTIFACT_ID));
    expect(screen.queryByLabelText('Revisions')).toBeNull();
  });

  it('lists every revision newest first, naming the agent or You', async () => {
    listArtifactRevisions.mockResolvedValueOnce([
      revision({ revision: 2, author: 'user', ask: null }),
      revision({ revision: 1, author: 'agent' }),
    ]);
    render(
      <ArtifactRevisionsSection sessionId={SESSION_ID} artifact={artifact} creatorName="Scout" />,
    );
    const rows = await waitFor(() => screen.getAllByTestId('artifact-revision-row'));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('v2');
    expect(rows[0]?.textContent).toContain('You');
    expect(rows[1]?.textContent).toContain('v1');
    expect(rows[1]?.textContent).toContain('Scout');
  });

  it('shows the restore ask on a restored revision', async () => {
    listArtifactRevisions.mockResolvedValueOnce([
      revision({ revision: 2, author: 'restore', ask: 'Restored v1' }),
      revision({ revision: 1, author: 'agent' }),
    ]);
    render(
      <ArtifactRevisionsSection sessionId={SESSION_ID} artifact={artifact} creatorName="Scout" />,
    );
    const rows = await waitFor(() => screen.getAllByTestId('artifact-revision-row'));
    expect(rows[0]?.textContent).toContain('Restored v1');
  });

  it('marks the current revision instead of offering to restore it', async () => {
    listArtifactRevisions.mockResolvedValueOnce([
      revision({ revision: 2, author: 'user' }),
      revision({ revision: 1, author: 'agent' }),
    ]);
    render(
      <ArtifactRevisionsSection sessionId={SESSION_ID} artifact={artifact} creatorName="Scout" />,
    );
    const rows = await waitFor(() => screen.getAllByTestId('artifact-revision-row'));
    expect(rows[0]?.textContent).toContain('Current');
    expect(rows[0]?.querySelector('[data-testid="artifact-revision-restore"]')).toBeNull();
    expect(rows[1]?.querySelector('[data-testid="artifact-revision-restore"]')).not.toBeNull();
  });

  it('restores an old revision through the shared store action', async () => {
    listArtifactRevisions.mockResolvedValueOnce([
      revision({ revision: 2, author: 'user' }),
      revision({ revision: 1, author: 'agent' }),
    ]);
    render(
      <ArtifactRevisionsSection sessionId={SESSION_ID} artifact={artifact} creatorName="Scout" />,
    );
    const restoreButton = await waitFor(() => screen.getByTestId('artifact-revision-restore'));
    fireEvent.click(restoreButton);
    await waitFor(() => {
      expect(restoreSpy).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        artifact,
        revision: 1,
      });
    });
  });

  it('logs a failed restore with Retry and draws no red line in the section', async () => {
    listArtifactRevisions.mockResolvedValueOnce([
      revision({ revision: 2, author: 'user' }),
      revision({ revision: 1, author: 'agent' }),
    ]);
    restoreSpy.mockRejectedValueOnce(new Error('the artifact is gone'));
    render(
      <ArtifactRevisionsSection sessionId={SESSION_ID} artifact={artifact} creatorName="Scout" />,
    );
    const restoreButton = await waitFor(() => screen.getByTestId('artifact-revision-restore'));
    fireEvent.click(restoreButton);
    await waitFor(() => expect(reportSpy).toHaveBeenCalledOnce());
    const reported = reportSpy.mock.calls[0]?.[0];
    expect(reported?.title).toBe("Couldn't restore version 1 of Session report");
    expect(reported?.sessionId).toBe(SESSION_ID);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await reported?.retry?.()).toBe(true);
    expect(restoreSpy).toHaveBeenCalledTimes(2);
  });

  it('sends a restore conflict back to the newer version with no Retry', async () => {
    listArtifactRevisions.mockResolvedValueOnce([
      revision({ revision: 2, author: 'user' }),
      revision({ revision: 1, author: 'agent' }),
    ]);
    restoreSpy.mockRejectedValueOnce(new RestoreConflictError());
    render(
      <ArtifactRevisionsSection sessionId={SESSION_ID} artifact={artifact} creatorName="Scout" />,
    );
    fireEvent.click(await waitFor(() => screen.getByTestId('artifact-revision-restore')));
    await waitFor(() => expect(reportSpy).toHaveBeenCalledOnce());
    const reported = reportSpy.mock.calls[0]?.[0];
    expect(reported?.title).toBe("Couldn't restore version 1 of Session report");
    expect(reported?.retry).toBeUndefined();
    expect(restoreSpy).toHaveBeenCalledOnce();
  });

  it('surfaces a failed load in plain words with Retry, never the exception text', async () => {
    listArtifactRevisions.mockRejectedValueOnce(
      new TypeError("Cannot read properties of undefined (reading 'invoke')"),
    );
    listArtifactRevisions.mockResolvedValueOnce([
      revision({ revision: 2, author: 'user' }),
      revision({ revision: 1, author: 'agent' }),
    ]);
    render(
      <ArtifactRevisionsSection sessionId={SESSION_ID} artifact={artifact} creatorName="Scout" />,
    );
    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toContain("Couldn't load revisions");
    expect(alert.textContent).not.toContain('invoke');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    const rows = await waitFor(() => screen.getAllByTestId('artifact-revision-row'));
    expect(rows).toHaveLength(2);
    expect(listArtifactRevisions).toHaveBeenCalledTimes(2);
  });
});
