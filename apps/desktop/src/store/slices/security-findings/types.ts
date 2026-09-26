import type {
  ProjectId,
  SecurityFindingId,
  SecurityFindingSubjectKind,
  WorkspaceId,
} from '@goodboy/types';
import type { SecurityFindingsState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type LoadSecurityFindingsParams = {
  readonly workspaceId: WorkspaceId;
};

export type DismissSecurityFindingParams = {
  readonly workspaceId: WorkspaceId;
  readonly findingId: SecurityFindingId;
};

export type FlagSecurityFindingAgainParams = {
  readonly workspaceId: WorkspaceId;
  readonly findingId: SecurityFindingId;
};

export type RecordScanFindingsParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly subjectKind: SecurityFindingSubjectKind;
  readonly subjectId: string;
  readonly text: string;
};

export type SecurityFindingsSlice = SecurityFindingsState & {
  loadSecurityFindings(params: LoadSecurityFindingsParams): Promise<void>;
  dismissSecurityFinding(params: DismissSecurityFindingParams): Promise<void>;
  flagSecurityFindingAgain(params: FlagSecurityFindingAgainParams): Promise<void>;
  recordScanFindings(params: RecordScanFindingsParams): Promise<void>;
};
