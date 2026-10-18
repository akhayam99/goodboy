import { insertFileVersion, listFileVersionsForSession } from '@goodboy/db';
import {
  brandId,
  type FileVersion,
  type FileVersionId,
  type FileVersionSnapshotSource,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { nowIso } from '../project-mounts/nowIso';
import type { FinalizedVersion } from '../../../features/file-versions/fileVersions';

type Params = Readonly<{
  sessionId: SessionId;
  snapshotSource: FileVersionSnapshotSource;
  providerRunId?: ProviderRunId;
  kept: ReadonlyArray<FinalizedVersion>;
  capturedAtMs: number;
}>;

export const persistFolderVersions = async ({
  sessionId,
  snapshotSource,
  providerRunId,
  kept,
  capturedAtMs,
}: Params): Promise<void> => {
  if (kept.length === 0) {
    return;
  }
  const existing = await listFileVersionsForSession({ db: tauriDatabase, sessionId });
  const stored = new Set<string>(existing.map((version) => version.id));
  const capturedAt = nowIso({ at: new Date(capturedAtMs) });
  for (const entry of kept) {
    if (stored.has(entry.id)) {
      continue;
    }
    const row: FileVersion = {
      id: brandId<FileVersionId>({ value: entry.id }),
      sessionId,
      relativePath: entry.relativePath,
      storedName: entry.storedName,
      sizeBytes: entry.sizeBytes,
      contentHash: entry.contentHash,
      changeKind: entry.changeKind,
      snapshotSource,
      ...(providerRunId !== undefined && { providerRunId }),
      capturedAt,
    };
    await insertFileVersion({ db: tauriDatabase, fileVersion: row });
  }
};
