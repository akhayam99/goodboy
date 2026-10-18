import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { FileVersionChangeKind, SessionId } from '@goodboy/types';

export type SnapshotManifestEntry = Readonly<{
  relativePath: string;
  sizeBytes: number;
  contentHash: string;
}>;

type SnapshotSkippedEntry = Readonly<{
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

type StagedSnapshotRun = Readonly<{
  sessionId: SessionId;
  runId: string;
  sessionDir: string;
  manifest: ReadonlyArray<SnapshotManifestEntry>;
}>;

type SkippedStagedSnapshotRun = Readonly<{
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
  return invokeCommand<BeginSnapshotResult>('file_versions_begin_snapshot', {
    args: { sessionDir, sessionId, runId, ...(sizeCapBytes !== undefined && { sizeCapBytes }) },
  });
};

export const fileVersionsFinalizeSnapshot = async ({
  sessionDir,
  sessionId,
  runId,
  manifest,
}: FinalizeSnapshotArgs): Promise<FinalizeSnapshotResult> => {
  return invokeCommand<FinalizeSnapshotResult>('file_versions_finalize_snapshot', {
    args: { sessionDir, sessionId, runId, manifest },
  });
};

export const fileVersionsListStagedSnapshots = async (): Promise<ListStagedSnapshotsResult> => {
  return invokeCommand<ListStagedSnapshotsResult>('file_versions_list_staged_snapshots');
};

export const fileVersionsRestore = async ({
  sessionDir,
  sessionId,
  relativePath,
  storedName,
}: RestoreVersionArgs): Promise<void> => {
  await invokeCommand('file_versions_restore', {
    args: { sessionDir, sessionId, relativePath, storedName },
  });
};

export const fileVersionsDelete = async ({
  sessionId,
  storedName,
}: DeleteVersionArgs): Promise<void> => {
  await invokeCommand('file_versions_delete', { args: { sessionId, storedName } });
};

export const fileVersionsPurgeSession = async ({ sessionId }: PurgeSessionArgs): Promise<void> => {
  await invokeCommand('file_versions_purge_session', { args: { sessionId } });
};

type FolderSkip = Readonly<{
  relativePath: string;
  reason: string;
  sizeBytes: number | null;
}>;

type FolderCopyMethod = 'clone' | 'copy';

export type FolderStatus = Readonly<{
  folderPath: string;
  isReady: boolean;
  isTurnOpen: boolean;
  fileCount: number;
  keptBytes: number;
  skipped: ReadonlyArray<FolderSkip>;
  method: FolderCopyMethod | null;
}>;

type FolderChangeKind = 'added' | 'modified' | 'deleted';

type FolderTurnChange = Readonly<{
  relativePath: string;
  change: FolderChangeKind;
  beforeHash: string | null;
  afterHash: string | null;
  beforeSizeBytes: number | null;
  afterSizeBytes: number | null;
  versionId: string | null;
  storedName: string | null;
  isPruned: boolean;
}>;

export type FolderTurnManifest = Readonly<{
  version: number;
  sessionId: SessionId;
  runId: string;
  folderId: string | null;
  folderPath: string;
  kind: 'turn' | 'restore';
  restoresRunId: string | null;
  startedAtMs: number;
  finishedAtMs: number;
  changes: ReadonlyArray<FolderTurnChange>;
  skipped: ReadonlyArray<FolderSkip>;
}>;

export type FolderFinalizeResult = Readonly<{
  sessionId: SessionId;
  runId: string;
  turn: FolderTurnManifest | null;
  kept: ReadonlyArray<FinalizedVersion>;
}>;

export type FolderBeginResult = Readonly<{
  runId: string;
  wasReady: boolean;
  copied: number;
  method: FolderCopyMethod | null;
  skipped: ReadonlyArray<FolderSkip>;
  recovered: ReadonlyArray<FolderFinalizeResult>;
}>;

export type StagedFolderRun = Readonly<{
  folderPath: string;
  sessionId: SessionId;
  runId: string;
  startedAtMs: number;
}>;

type FolderRestoreStatus = 'restored' | 'changedSince' | 'nothingToRestore';

export type FolderRestoreResult = Readonly<{
  status: FolderRestoreStatus;
  changedSince: ReadonlyArray<string>;
  turn: FolderTurnManifest | null;
  kept: ReadonlyArray<FinalizedVersion>;
}>;

export type FolderCheckResult = Readonly<{
  changedSince: ReadonlyArray<string>;
  pending: ReadonlyArray<string>;
}>;

export type FolderReadSide = 'before' | 'after';

export type FolderReadResult = Readonly<{
  kind: 'text' | 'binary' | 'missing' | 'unavailable' | 'tooLarge';
  text: string | null;
  sizeBytes: number | null;
}>;

export type FolderPruneSession = Readonly<{
  sessionId: SessionId;
  endedAtMs: number | null;
}>;

type PrunedFolderVersion = Readonly<{
  sessionId: SessionId;
  runId: string;
  versionId: string;
  storedName: string;
  relativePath: string;
}>;

export type FolderPruneResult = Readonly<{
  pruned: ReadonlyArray<PrunedFolderVersion>;
  removedTurns: number;
  versionBytes: number;
  capBytes: number;
}>;

export type FolderSize = Readonly<{
  folderPath: string;
  isReady: boolean;
  fileCount: number;
  keptBytes: number;
  versionBytes: number;
  versionCount: number;
  capBytes: number;
}>;

type FolderPathParams = Readonly<{ folderPath: string }>;

type FolderPrepareParams = Readonly<{ folderPath: string; folderId?: string }>;

type FolderBeginParams = Readonly<{
  folderPath: string;
  folderId?: string;
  sessionId: SessionId;
  runId: string;
}>;

type FolderRunParams = Readonly<{
  folderPath: string;
  sessionId: SessionId;
  runId: string;
}>;

type FolderSessionParams = Readonly<{ folderPath: string; sessionId: SessionId }>;

type FolderCheckParams = FolderRunParams & Readonly<{ relativePaths?: ReadonlyArray<string> }>;

type FolderRestoreParams = FolderCheckParams &
  Readonly<{ restoreRunId: string; isForced: boolean }>;

type FolderReadParams = FolderRunParams & Readonly<{ relativePath: string; side: FolderReadSide }>;

type FolderPruneParams = Readonly<{
  folderPath: string;
  sessions: ReadonlyArray<FolderPruneSession>;
  nowMs: number;
}>;

export const fileVersionsFolderPrepare = async ({
  folderPath,
  folderId,
}: FolderPrepareParams): Promise<FolderStatus> =>
  invokeCommand<FolderStatus>('file_versions_folder_prepare', {
    args: { folderPath, ...(folderId !== undefined && { folderId }) },
  });

export const fileVersionsFolderStatus = async ({
  folderPath,
}: FolderPathParams): Promise<FolderStatus> =>
  invokeCommand<FolderStatus>('file_versions_folder_status', { args: { folderPath } });

export const fileVersionsFolderBegin = async ({
  folderPath,
  folderId,
  sessionId,
  runId,
}: FolderBeginParams): Promise<FolderBeginResult> =>
  invokeCommand<FolderBeginResult>('file_versions_folder_begin', {
    args: { folderPath, sessionId, runId, ...(folderId !== undefined && { folderId }) },
  });

export const fileVersionsFolderFinalize = async ({
  folderPath,
  sessionId,
  runId,
}: FolderRunParams): Promise<FolderFinalizeResult> =>
  invokeCommand<FolderFinalizeResult>('file_versions_folder_finalize', {
    args: { folderPath, sessionId, runId },
  });

export const fileVersionsFolderDiscard = async ({
  folderPath,
  sessionId,
  runId,
}: FolderRunParams): Promise<boolean> =>
  invokeCommand<boolean>('file_versions_folder_discard', {
    args: { folderPath, sessionId, runId },
  });

export const fileVersionsFolderListStaged = async (): Promise<ReadonlyArray<StagedFolderRun>> =>
  invokeCommand<ReadonlyArray<StagedFolderRun>>('file_versions_folder_list_staged');

export const fileVersionsFolderListTurns = async ({
  folderPath,
  sessionId,
}: FolderSessionParams): Promise<ReadonlyArray<FolderTurnManifest>> =>
  invokeCommand<ReadonlyArray<FolderTurnManifest>>('file_versions_folder_list_turns', {
    args: { folderPath, sessionId },
  });

export const fileVersionsFolderCheck = async ({
  folderPath,
  sessionId,
  runId,
  relativePaths,
}: FolderCheckParams): Promise<FolderCheckResult> =>
  invokeCommand<FolderCheckResult>('file_versions_folder_check', {
    args: { folderPath, sessionId, runId, ...(relativePaths !== undefined && { relativePaths }) },
  });

export const fileVersionsFolderRestore = async ({
  folderPath,
  sessionId,
  runId,
  relativePaths,
  restoreRunId,
  isForced,
}: FolderRestoreParams): Promise<FolderRestoreResult> =>
  invokeCommand<FolderRestoreResult>('file_versions_folder_restore', {
    args: {
      folderPath,
      sessionId,
      runId,
      restoreRunId,
      isForced,
      ...(relativePaths !== undefined && { relativePaths }),
    },
  });

export const fileVersionsFolderRead = async ({
  folderPath,
  sessionId,
  runId,
  relativePath,
  side,
}: FolderReadParams): Promise<FolderReadResult> =>
  invokeCommand<FolderReadResult>('file_versions_folder_read', {
    args: { folderPath, sessionId, runId, relativePath, side },
  });

export const fileVersionsFolderSessions = async ({
  folderPath,
}: FolderPathParams): Promise<ReadonlyArray<SessionId>> =>
  invokeCommand<ReadonlyArray<SessionId>>('file_versions_folder_sessions', {
    args: { folderPath },
  });

export const fileVersionsFolderPrune = async ({
  folderPath,
  sessions,
  nowMs,
}: FolderPruneParams): Promise<FolderPruneResult> =>
  invokeCommand<FolderPruneResult>('file_versions_folder_prune', {
    args: { folderPath, sessions, nowMs },
  });

export const fileVersionsFolderSize = async ({
  folderPath,
}: FolderPathParams): Promise<FolderSize> =>
  invokeCommand<FolderSize>('file_versions_folder_size', { args: { folderPath } });

export const fileVersionsFolderForget = async ({ folderPath }: FolderPathParams): Promise<void> => {
  await invokeCommand('file_versions_folder_forget', { args: { folderPath } });
};
