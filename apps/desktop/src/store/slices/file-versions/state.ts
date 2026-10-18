import type { SessionId, FileVersion, ProjectId, ProviderRunId } from '@goodboy/types';
import type {
  FolderStatus,
  FolderTurnManifest,
} from '../../../features/file-versions/fileVersions';
import type { TurnChangesSummary } from '../../../features/file-versions/turnChanges';
import type { FolderHistorySize } from '../../../features/file-versions/folderHistorySize';

type FolderChangesSummary = Readonly<{
  counts: TurnChangesSummary;
  restored: Readonly<Record<string, string>>;
}>;

type FolderCaptureFailure = Readonly<{
  sessionId: SessionId;
  folderPaths: ReadonlyArray<string>;
  message: string;
}>;

export type FolderVersionsStatus =
  | Readonly<{ kind: 'building' }>
  | Readonly<{ kind: 'ready'; status: FolderStatus }>
  | Readonly<{ kind: 'failed'; message: string }>;

export type FileVersionsState = {
  readonly sessionFileVersions: Readonly<Record<SessionId, ReadonlyArray<FileVersion> | undefined>>;
  readonly sessionFileVersionsLoading: Readonly<Record<SessionId, boolean>>;
  readonly sessionFileVersionSelectedPath: Readonly<Record<SessionId, string | null>>;
  readonly sessionFolderTurns: Readonly<
    Record<SessionId, ReadonlyArray<FolderTurnManifest> | undefined>
  >;
  readonly sessionFolderSummary: Readonly<Record<SessionId, FolderChangesSummary | undefined>>;
  readonly folderCaptureFailures: Readonly<Record<ProviderRunId, FolderCaptureFailure>>;
  readonly folderHistorySizes: Readonly<Record<ProjectId, FolderHistorySize>>;
  readonly folderVersionsStatus: Readonly<Record<ProjectId, FolderVersionsStatus>>;
};

export const fileVersionsInitialState: FileVersionsState = {
  sessionFileVersions: {},
  sessionFileVersionsLoading: {},
  sessionFileVersionSelectedPath: {},
  sessionFolderTurns: {},
  sessionFolderSummary: {},
  folderCaptureFailures: {},
  folderHistorySizes: {},
  folderVersionsStatus: {},
};
