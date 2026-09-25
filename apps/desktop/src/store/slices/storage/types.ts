import type {
  ArtifactId,
  ArtifactKind,
  MountId,
  SessionId,
  WorkspaceId,
  WorktreeRemovalMode,
  WorktreeRemovalReason,
} from '@goodboy/types';
import type { WorktreeFolderFacts } from '../../../features/worktree/worktree';

export type { SetFn, GetFn } from '../../slice-types';

export type StorageFolderOrigin = 'in-use' | 'archived' | 'ledger';

export type StorageFolderWhy =
  'active-session' | 'archived-session' | 'deleted-session' | 'no-session' | 'kept-by-goodboy';

export type StorageFolderStatus =
  | 'in-use'
  | 'checking'
  | 'safe'
  | 'dirty'
  | 'writing'
  | 'operation'
  | 'not-tracked'
  | 'unavailable';

export type StorageBucket = 'review' | 'in-use' | 'kept';

export type StorageFolder = {
  readonly path: string;
  readonly repoRoot: string;
  readonly branch: string;
  readonly origin: StorageFolderOrigin;
  readonly why: StorageFolderWhy;
  readonly sessionId: SessionId | null;
  readonly sessionGoal: string | null;
  readonly mountId: MountId | null;
  readonly revision: number | null;
  readonly ledgerId: string | null;
  readonly workspaceId: WorkspaceId | null;
  readonly sessionActivityAt: number | null;
  readonly sizeBytes: number | null;
  readonly sizedAt: number | null;
  readonly facts: WorktreeFolderFacts | null;
  readonly keptAt: number | null;
  readonly keptUntil: number | null;
};

export type StorageRoot = {
  readonly repoRoot: string;
  readonly projectName: string;
  readonly workspaceId: WorkspaceId | null;
  readonly workspaceName: string | null;
  readonly isDisconnected: boolean;
};

export type StorageStats = {
  readonly databaseBytes: number;
  readonly archivedSessionCount: number;
  readonly archivedTranscriptRows: number;
  readonly archivedTranscriptBytes: number;
  readonly snapshotBytes: number;
  readonly snapshotCount: number;
  readonly appDataFolder: string | null;
  readonly diskFreeBytes: number | null;
  readonly checkedAt: number;
};

export type StorageFilter = 'review' | 'in-use' | 'kept';

export type StorageFocus = {
  readonly filter: StorageFilter;
  readonly workspaceId: WorkspaceId | null;
};

export type StorageRemoval =
  | { readonly kind: 'removed'; readonly path: string; readonly sizeBytes: number }
  | {
      readonly kind: 'kept';
      readonly path: string;
      readonly reasons: ReadonlyArray<WorktreeRemovalReason>;
      readonly message: string | null;
    }
  | { readonly kind: 'failed'; readonly path: string; readonly message: string };

export type StorageRemovalSummary = {
  readonly removed: number;
  readonly freedBytes: number;
  readonly kept: ReadonlyArray<StorageRemoval>;
};

export type RemoveStorageFoldersParams = {
  readonly paths: ReadonlyArray<string>;
  readonly mode: WorktreeRemovalMode;
};

export type KeepStorageFolderParams = {
  readonly path: string;
  readonly days: number | null;
  readonly isStopping?: boolean;
};

export type StorageSizeCache = Readonly<
  Record<string, { readonly sizeBytes: number; readonly sizedAt: number }>
>;

export type StorageArtifact = {
  readonly id: ArtifactId;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly sessionGoal: string;
  readonly deletedAt: number;
  readonly updatedAt: number;
  readonly openedAt: number | null;
  readonly keptAt: number | null;
  readonly keptUntil: number | null;
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly workspaceSlug: string;
  readonly folder: string;
  readonly sizeBytes: number | null;
};

export type StorageArtifactFilter = 'review' | 'kept';

export type KeepStorageArtifactParams = {
  readonly id: ArtifactId;
  readonly days: number | null;
  readonly isStopping?: boolean;
};

export type DeleteStorageArtifactsParams = {
  readonly ids: ReadonlyArray<ArtifactId>;
};

export type StorageArtifactDeletion = {
  readonly deleted: number;
  readonly failed: ReadonlyArray<{ readonly id: ArtifactId; readonly message: string }>;
};
