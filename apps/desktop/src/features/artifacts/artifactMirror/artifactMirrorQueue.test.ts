// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionArtifact } from '@goodboy/types';

const { writeSpy, pendingSpy } = vi.hoisted(() => ({
  writeSpy: vi.fn(async (_args: unknown) => '/mirror/folder'),
  pendingSpy: vi.fn(async ({ entries }: { entries: ReadonlyArray<{ folder: string }> }) =>
    entries.map((entry) => entry.folder),
  ),
}));

vi.mock('./artifactMirrorInvoke', () => ({
  writeArtifactMirror: (args: unknown) => writeSpy(args),
  pendingArtifactMirrors: (args: { entries: ReadonlyArray<{ folder: string }> }) =>
    pendingSpy(args),
}));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: async () => '0.7.0' }));

import { mirrorArtifacts, resetArtifactMirrorQueue } from './artifactMirrorQueue';

const report = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    id: 'report-3f9a1c',
    sessionId: 'session-1',
    agentId: 'agent-1',
    workflowRunId: null,
    kind: 'report',
    schemaVersion: 1,
    title: 'Rounding drift',
    sourceFormat: 'markdown',
    sourceText: '## Cause\n\ntext',
    metadata: { reportType: 'session-summary' },
    status: 'active',
    revision: 1,
    sourceTurnId: null,
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-25T10:00:00.000Z',
    ...over,
  }) as unknown as SessionArtifact;

beforeEach(() => {
  vi.clearAllMocks();
  resetArtifactMirrorQueue();
});

afterEach(() => {
  resetArtifactMirrorQueue();
});

describe('mirrorArtifacts', () => {
  it('writes a report once per revision into its workspace folder', async () => {
    await mirrorArtifacts({ items: [{ artifact: report(), workspaceSlug: 'harborline' }] });
    await mirrorArtifacts({ items: [{ artifact: report(), workspaceSlug: 'harborline' }] });
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const args = writeSpy.mock.calls[0]?.[0] as {
      readonly workspaceSlug: string;
      readonly folder: string;
      readonly files: ReadonlyArray<{ readonly path: string; readonly contents: string }>;
    };
    expect(args.workspaceSlug).toBe('harborline');
    expect(args.folder).toBe('2026-09-25-rounding-drift-3f9a1c');
    expect(args.files.map((file) => file.path)).toEqual([
      'index.html',
      'document.css',
      'source.md',
      'meta.json',
    ]);
    const meta = JSON.parse(args.files[3]?.contents ?? '{}') as Record<string, unknown>;
    expect(meta).toMatchObject({
      id: 'report-3f9a1c',
      session: 'session-1',
      workspace: 'harborline',
      revision: 1,
      appVersion: '0.7.0',
    });

    await mirrorArtifacts({
      items: [
        {
          artifact: report({ revision: 2, updatedAt: '2026-09-25T11:00:00.000Z' }),
          workspaceSlug: 'harborline',
        },
      ],
    });
    expect(writeSpy).toHaveBeenCalledTimes(2);
  });

  it('skips what the disk already holds at the same revision', async () => {
    pendingSpy.mockResolvedValueOnce([]);
    await mirrorArtifacts({ items: [{ artifact: report(), workspaceSlug: 'harborline' }] });
    expect(writeSpy).not.toHaveBeenCalled();
    await mirrorArtifacts({ items: [{ artifact: report(), workspaceSlug: 'harborline' }] });
    expect(pendingSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps going when a write fails, and retries it next time', async () => {
    writeSpy.mockRejectedValueOnce(new Error('disk full'));
    await mirrorArtifacts({ items: [{ artifact: report(), workspaceSlug: 'harborline' }] });
    await mirrorArtifacts({ items: [{ artifact: report(), workspaceSlug: 'harborline' }] });
    expect(writeSpy).toHaveBeenCalledTimes(2);
  });

  it('mirrors a wireframe as its exported folder with the mirror meta', async () => {
    const wireframe = report({
      id: 'frame-8d21e0',
      kind: 'wireframe',
      title: 'Settlement flow',
      sourceFormat: 'json',
      metadata: { fidelity: 'low', designProfile: {} },
      sourceText: JSON.stringify({
        version: 1,
        initialScreenId: 'batches',
        theme: { name: 'harborline' },
        screens: [
          {
            id: 'batches',
            title: 'Batches',
            viewport: 'desktop',
            root: {
              id: 'root',
              kind: 'stack',
              direction: 'column',
              children: [{ id: 'title', kind: 'text', text: 'Batches' }],
            },
          },
        ],
        transitions: [],
      }),
    });
    await mirrorArtifacts({ items: [{ artifact: wireframe, workspaceSlug: 'harborline' }] });
    const args = writeSpy.mock.calls[0]?.[0] as {
      readonly files: ReadonlyArray<{ readonly path: string; readonly contents: string }>;
    };
    expect(args.files.map((file) => file.path)).toContain('screens/batches.html');
    const meta = args.files.find((file) => file.path === 'meta.json');
    expect(JSON.parse(meta?.contents ?? '{}')).toMatchObject({ workspace: 'harborline' });
    expect(args.files.filter((file) => file.path === 'meta.json')).toHaveLength(1);
  });
});
