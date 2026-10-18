import type {
  FirstCommitPlan,
  FolderGitProbe,
  FolderPurpose,
  FolderSignals,
  IsoDateTime,
  ProjectId,
} from '@goodboy/types';

export type FolderSignalsRead = {
  readonly signals: FolderSignals;
  readonly preselected: FolderPurpose | null;
};

export type FolderGitNotice =
  | Readonly<{
      kind: 'switched' | 'ask';
      foundAt: IsoDateTime;
      commitCount: number;
      branch: string | null;
    }>
  | Readonly<{ kind: 'above'; foundAt: IsoDateTime; rootPath: string }>;

export type FolderGitChoice = 'in-place';

export type FolderPurposeState = {
  readonly folderPurpose: Readonly<Record<ProjectId, FolderPurpose>>;
  readonly folderSignals: Readonly<Record<string, FolderSignalsRead>>;
  readonly folderGit: Readonly<Record<ProjectId, FolderGitProbe>>;
  readonly folderGitNotice: Readonly<Record<ProjectId, FolderGitNotice>>;
  readonly folderGitChoice: Readonly<Record<ProjectId, FolderGitChoice>>;
  readonly firstCommitPlans: Readonly<Record<ProjectId, FirstCommitPlan>>;
};

export const folderPurposeInitialState: FolderPurposeState = {
  folderPurpose: {},
  folderSignals: {},
  folderGit: {},
  folderGitNotice: {},
  folderGitChoice: {},
  firstCommitPlans: {},
};
