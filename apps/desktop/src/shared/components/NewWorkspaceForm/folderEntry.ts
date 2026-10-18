import type { FolderPurpose, FolderSignals, ProjectId, WorkspaceId } from '@goodboy/types';

export type MoveChoice = 'ask' | 'move' | 'leave';

export type FolderConflict = {
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly sessionCount: number;
  readonly runningAgentCount: number;
  readonly isShell: boolean;
  readonly choice: MoveChoice;
};

export type FolderProblem = 'permission_denied' | 'not_found' | 'not_a_directory' | 'git_failed';

type FolderBase = {
  readonly path: string;
  readonly name: string;
  readonly pick: number;
  readonly isIncluded: boolean;
};

export type RepositoryScope = 'repository' | 'folder';

export type RepositoryFolder = FolderBase & {
  readonly kind: 'repository';
  readonly defaultBranch: string | null;
  readonly snappedFrom: string | null;
  readonly scope: RepositoryScope;
  readonly conflict: FolderConflict | null;
};

export type PlainFolder = FolderBase & {
  readonly kind: 'plain';
  readonly purpose: FolderPurpose | null;
  readonly preselected: FolderPurpose | null;
  readonly signals: FolderSignals | null;
  readonly isSignalsUnreadable: boolean;
  readonly isGitInit: boolean;
  readonly firstCommitFiles: number | null;
  readonly conflict: FolderConflict | null;
};

export type UnreadableFolder = FolderBase & {
  readonly kind: 'unreadable';
  readonly problem: FolderProblem;
  readonly detail: string | null;
};

export type FolderEntry = RepositoryFolder | PlainFolder | UnreadableFolder;

export type FoundSummary = {
  readonly parentName: string;
  readonly repositoryCount: number;
};
