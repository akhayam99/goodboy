import { invoke } from '@tauri-apps/api/core';
import type { FileVersionChangeKind, SessionId } from '@goodboy/types';

export type SnapshotManifestEntry = Readonly<{
  relativePath: string;
  sizeBytes: number;
  contentHash: string;
}>;

export type SnapshotSkippedEntry = Readonly<{
  relativePath: string;
  reason: string;
  sizeBytes?: number;
}>;

export type BeginSnapshotArgs = Readonly<{
  sessionDir: string;
  sessionId: SessionId;
  runId: string;
  sizeCapBytes?: number;
}>;

export type BeginSnapshotResult = Readonly<{
  manifest: ReadonlyArray<SnapshotManifestEntry>;
  skipped: ReadonlyArray<SnapshotSkippedEntry>;
}>;

export type FinalizedVersion = Readonly<{
  id: string;
  relativePath: string;
  storedName: string;
  sizeBytes: number;
  contentHash: string;
  changeKind: FileVersionChangeKind;
}>;

export type FinalizeSnapshotArgs = Readonly<{
  sessionDir: string;
  sessionId: SessionId;
  runId: string;
  manifest: ReadonlyArray<SnapshotManifestEntry>;
}>;

export type FinalizeSnapshotResult = Readonly<{
  kept: ReadonlyArray<FinalizedVersion>;
}>;

export type StagedSnapshotRun = Readonly<{
  sessionId: SessionId;
  runId: string;
  sessionDir: string;
  manifest: ReadonlyArray<SnapshotManifestEntry>;
}>;

export type SkippedStagedSnapshotRun = Readonly<{
  sessionId: SessionId;
  runId: string;
  reason: string;
}>;

export type ListStagedSnapshotsResult = Readonly<{
  runs: ReadonlyArray<StagedSnapshotRun>;
  skipped: ReadonlyArray<SkippedStagedSnapshotRun>;
}>;

type RestoreVersionArgs = Readonly<{
  sessionDir: string;
  sessionId: SessionId;
  relativePath: string;
  storedName: string;
}>;

type DeleteVersionArgs = Readonly<{
  sessionId: SessionId;
  storedName: string;
}>;

type PurgeSessionArgs = Readonly<{
  sessionId: SessionId;
}>;

export const fileVersionsBeginSnapshot = async ({
  sessionDir,
  sessionId,
  runId,
  sizeCapBytes,
}: BeginSnapshotArgs): Promise<BeginSnapshotResult> => {
  return invoke<BeginSnapshotResult>('file_versions_begin_snapshot', {
    args: { sessionDir, sessionId, runId, ...(sizeCapBytes !== undefined && { sizeCapBytes }) },
  });
};

export const fileVersionsFinalizeSnapshot = async ({
  sessionDir,
  sessionId,
  runId,
  manifest,
}: FinalizeSnapshotArgs): Promise<FinalizeSnapshotResult> => {
  return invoke<FinalizeSnapshotResult>('file_versions_finalize_snapshot', {
    args: { sessionDir, sessionId, runId, manifest },
  });
};

export const fileVersionsListStagedSnapshots = async (): Promise<ListStagedSnapshotsResult> => {
  return invoke<ListStagedSnapshotsResult>('file_versions_list_staged_snapshots');
};

export const fileVersionsRestore = async ({
  sessionDir,
  sessionId,
  relativePath,
  storedName,
}: RestoreVersionArgs): Promise<void> => {
  await invoke('file_versions_restore', {
    args: { sessionDir, sessionId, relativePath, storedName },
  });
};

export const fileVersionsDelete = async ({
  sessionId,
  storedName,
}: DeleteVersionArgs): Promise<void> => {
  await invoke('file_versions_delete', { args: { sessionId, storedName } });
};

export const fileVersionsPurgeSession = async ({ sessionId }: PurgeSessionArgs): Promise<void> => {
  await invoke('file_versions_purge_session', { args: { sessionId } });
};
