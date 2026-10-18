export type FirstCommitEntryKind =
  'included' | 'dependencies' | 'output' | 'secret' | 'system' | 'goodboy' | 'repository';

export type FirstCommitEntry = Readonly<{
  key: string;
  kind: FirstCommitEntryKind;
  files: number;
  sample: ReadonlyArray<string>;
  isLeftOut: boolean;
  canToggle: boolean;
  ignore: string | null;
}>;

export type FirstCommitStart = 'no_git' | 'no_commits';

export type FirstCommitAuthor = Readonly<{
  name: string;
  email: string;
  isFallback: boolean;
}>;

export type FirstCommitPlan = Readonly<{
  rootPath: string;
  start: FirstCommitStart;
  branch: string;
  author: FirstCommitAuthor;
  entries: ReadonlyArray<FirstCommitEntry>;
  hasIgnoreFile: boolean;
}>;

export type FirstCommit = Readonly<{
  rootPath: string;
  branch: string;
  commit: string;
  files: number;
}>;

export type FolderGitProbeState = 'none' | 'empty' | 'tracked' | 'above';

export type FolderGitProbe = Readonly<{
  path: string;
  state: FolderGitProbeState;
  rootPath: string | null;
  branch: string | null;
  commitCount: number;
  remoteUrl: string | null;
}>;
