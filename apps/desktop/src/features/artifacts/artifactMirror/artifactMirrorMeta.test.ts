import { describe, expect, it } from 'vitest';
import type { ReportArtifact } from '@goodboy/types';
import { ARTIFACT_RENDERER_VERSION, artifactMirrorMeta } from './artifactMirrorMeta';

const artifact = {
  id: 'report-1',
  sessionId: 'session-1',
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Rounding drift',
  sourceFormat: 'markdown',
  sourceText: 'text',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 3,
  sourceTurnId: null,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T11:00:00.000Z',
} as unknown as ReportArtifact;

describe('artifactMirrorMeta', () => {
  it('carries the renderer version, so a restyle can mark old files stale', () => {
    const meta = artifactMirrorMeta({ artifact, workspaceSlug: 'harborline', appVersion: '1.0.0' });
    expect(meta.rendererVersion).toBe(ARTIFACT_RENDERER_VERSION);
    expect(meta.rendererVersion.length).toBeGreaterThan(0);
  });
});
