import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileVersionId, SessionId } from '@goodboy/types';

const {
  fileVersionsBeginSnapshot,
  fileVersionsRestore,
  fileVersionsFinalizeSnapshot,
  persistFinalizedFileVersions,
} = vi.hoisted(() => ({
  fileVersionsBeginSnapshot: vi.fn(),
  fileVersionsRestore: vi.fn(),
  fileVersionsFinalizeSnapshot: vi.fn(),
  persistFinalizedFileVersions: vi.fn(),
}));

vi.mock('../../../features/file-versions/fileVersions', () => ({
  fileVersionsBeginSnapshot,
  fileVersionsRestore,
  fileVersionsFinalizeSnapshot,
}));

vi.mock('./persistFinalizedFileVersions', () => ({
  persistFinalizedFileVersions,
}));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: {},
}));

import { restoreSessionFileVersion } from './restoreSessionFileVersion';

const SESSION_ID = 'session-1' as SessionId;
const VERSION_ID = 'version-1' as FileVersionId;

describe('restoreSessionFileVersion', () => {
  beforeEach(() => {
    fileVersionsBeginSnapshot.mockReset();
    fileVersionsRestore.mockReset();
    fileVersionsFinalizeSnapshot.mockReset();
    persistFinalizedFileVersions.mockReset();
    fileVersionsBeginSnapshot.mockResolvedValue({
      manifest: [
        { relativePath: 'docs/plan.md', sizeBytes: 7, contentHash: 'hash-plan' },
        { relativePath: 'notes/todo.md', sizeBytes: 8, contentHash: 'hash-todo' },
      ],
      skipped: [],
    });
    fileVersionsRestore.mockResolvedValue(undefined);
    fileVersionsFinalizeSnapshot.mockResolvedValue({
      kept: [
        {
          id: 'backup-1',
          relativePath: 'docs/plan.md',
          storedName: 'backup-1-plan.md',
          sizeBytes: 7,
          contentHash: 'hash-plan',
          changeKind: 'modified',
        },
      ],
    });
    persistFinalizedFileVersions.mockResolvedValue(undefined);
  });

  it('captures the current file before restore overwrite', async () => {
    const loadSessionFileVersions = vi.fn(async () => undefined);
    const get = () =>
      ({
        sessionFileVersions: {
          [SESSION_ID]: [
            {
              id: VERSION_ID,
              sessionId: SESSION_ID,
              relativePath: 'docs/plan.md',
              storedName: 'stored-plan.bin',
              sizeBytes: 7,
              contentHash: 'hash-target',
              changeKind: 'modified',
              snapshotSource: 'agent_turn',
              capturedAt: '2026-08-02T01:00:00.000Z',
            },
          ],
        },
        loadSessionFileVersions,
      }) as never;

    await restoreSessionFileVersion(
      vi.fn(),
      get,
    )({
      sessionId: SESSION_ID,
      versionId: VERSION_ID,
      sessionDir: '/tmp/simple-session',
    });

    expect(fileVersionsBeginSnapshot).toHaveBeenCalledWith({
      sessionDir: '/tmp/simple-session',
      sessionId: SESSION_ID,
      runId: expect.any(String),
    });
    expect(fileVersionsRestore).toHaveBeenCalledWith({
      sessionDir: '/tmp/simple-session',
      sessionId: SESSION_ID,
      relativePath: 'docs/plan.md',
      storedName: 'stored-plan.bin',
    });
    expect(fileVersionsFinalizeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionDir: '/tmp/simple-session',
        sessionId: SESSION_ID,
        manifest: [{ relativePath: 'docs/plan.md', sizeBytes: 7, contentHash: 'hash-plan' }],
      }),
    );
    expect(fileVersionsBeginSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      fileVersionsRestore.mock.invocationCallOrder[0]!,
    );
    expect(fileVersionsRestore.mock.invocationCallOrder[0]).toBeLessThan(
      fileVersionsFinalizeSnapshot.mock.invocationCallOrder[0]!,
    );
    expect(persistFinalizedFileVersions).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      snapshotSource: 'restore',
      kept: [
        {
          id: 'backup-1',
          relativePath: 'docs/plan.md',
          storedName: 'backup-1-plan.md',
          sizeBytes: 7,
          contentHash: 'hash-plan',
          changeKind: 'modified',
        },
      ],
    });
    expect(loadSessionFileVersions).toHaveBeenCalledWith({ sessionId: SESSION_ID, force: true });
  });
});
