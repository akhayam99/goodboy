import type {
  ConfigBundleImportResult,
  ExportGroups,
  ExportPreview,
  ImportPreview,
} from '@goodboy/types';
import { DEFAULT_EXPORT_GROUPS } from '@goodboy/types';

type BackupExportPhase = 'idle' | 'previewing' | 'writing' | 'done' | 'error';
type BackupImportPhase = 'idle' | 'choosing' | 'previewing' | 'applying' | 'done' | 'error';

export type BackupState = {
  readonly backupExportGroups: ExportGroups;
  readonly backupExportPreview: ExportPreview | null;
  readonly backupExportLeaveOut: ReadonlyArray<string>;
  readonly backupExportPhase: BackupExportPhase;
  readonly backupExportError: string | null;
  readonly backupExportedPath: string | null;

  readonly backupImportPath: string | null;
  readonly backupImportProjectParent: string | null;
  readonly backupImportPreview: ImportPreview | null;
  readonly backupImportWorkspaceTargets: Readonly<Record<string, string>>;
  readonly backupImportResolvedPaths: Readonly<Record<string, string>>;
  readonly backupImportPhase: BackupImportPhase;
  readonly backupImportError: string | null;
  readonly backupImportResult: ConfigBundleImportResult | null;
};

export const backupInitialState: BackupState = {
  backupExportGroups: DEFAULT_EXPORT_GROUPS,
  backupExportPreview: null,
  backupExportLeaveOut: [],
  backupExportPhase: 'idle',
  backupExportError: null,
  backupExportedPath: null,

  backupImportPath: null,
  backupImportProjectParent: null,
  backupImportPreview: null,
  backupImportWorkspaceTargets: {},
  backupImportResolvedPaths: {},
  backupImportPhase: 'idle',
  backupImportError: null,
  backupImportResult: null,
};
