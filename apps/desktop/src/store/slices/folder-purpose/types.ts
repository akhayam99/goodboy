import type { FirstCommitPlan, FolderGitProbe, FolderPurpose, ProjectId } from '@goodboy/types';
import type { KeyedQueue } from '../../../shared/utils/keyedQueue';
import type { LatestOnly } from '../state-writes/latestOnly';
import type { FolderPurposeState, FolderSignalsRead } from './state';
import type { GetFn, SetFn } from '../../slice-types';

export type { SetFn } from '../../slice-types';

export type FolderPurposeDeps = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly queue: KeyedQueue;
};

export type FolderSignalsDeps = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly latest: LatestOnly;
};

export type FolderGitDeps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export type FolderGitTargetParams = {
  readonly projectId: ProjectId;
};

export type ProbeFolderGitParams = FolderGitTargetParams;

export type LoadFolderPurposeParams = {
  readonly projectId: ProjectId;
};

export type SetFolderPurposeParams = {
  readonly projectId: ProjectId;
  readonly purpose: FolderPurpose;
};

export type ScanFolderSignalsParams = {
  readonly path: string;
};

export type FolderPurposeSlice = FolderPurposeState & {
  hydrateFolderPurposes(): Promise<void>;
  loadFolderPurpose(params: LoadFolderPurposeParams): Promise<FolderPurpose | null>;
  setFolderPurpose(params: SetFolderPurposeParams): Promise<FolderPurpose>;
  scanFolderSignals(params: ScanFolderSignalsParams): Promise<FolderSignalsRead | null>;
  probeFolderGit(params: ProbeFolderGitParams): Promise<FolderGitProbe | null>;
  loadFirstCommitPlan(params: FolderGitTargetParams): Promise<FirstCommitPlan | null>;
  keepFolderInPlace(params: FolderGitTargetParams): Promise<void>;
  switchFolderToRepo(params: FolderGitTargetParams): Promise<void>;
  dismissFolderGitNotice(params: FolderGitTargetParams): void;
};
