import type { ProjectId, WorkspaceId } from '@goodboy/types';
import type { MovedProjectVerdict, RepoIdentity } from '../../../shared/lib/repo';

export type ProjectRelocationCandidate = {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly fromRoot: string;
  readonly toRoot: string | null;
  readonly verdict: MovedProjectVerdict;
  readonly identity: RepoIdentity | null;
  readonly isSelected: boolean;
  readonly status: 'ready' | 'updating' | 'done';
};

export type CompletedProjectRelocation = {
  readonly relocationId: string;
  readonly projectId: ProjectId;
  readonly fromRoot: string;
  readonly toRoot: string;
  readonly restoredSessionFolders: number;
  readonly repairedGitLinks: boolean;
};

export type ProjectRelocationState = {
  readonly projectRelocationWorkspaceId: WorkspaceId | null;
  readonly projectRelocationCandidates: ReadonlyArray<ProjectRelocationCandidate>;
  readonly projectRelocationCompleted: ReadonlyArray<CompletedProjectRelocation>;
  readonly projectRelocationPhase: 'idle' | 'preview' | 'moving' | 'success' | 'error';
  readonly projectRelocationError: string | null;
};

export const projectRelocationInitialState: ProjectRelocationState = {
  projectRelocationWorkspaceId: null,
  projectRelocationCandidates: [],
  projectRelocationCompleted: [],
  projectRelocationPhase: 'idle',
  projectRelocationError: null,
};
