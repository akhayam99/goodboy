import type { Project, ProjectId, WorkspaceGitStatus } from '@goodboy/types';

type ProjectCheckoutUpdate =
  | { readonly kind: 'updating' }
  | { readonly kind: 'updated'; readonly commits: number }
  | { readonly kind: 'skipped'; readonly reason: string }
  | { readonly kind: 'failed'; readonly reason: string };

export type ProjectsState = {
  readonly projects: ReadonlyArray<Project>;
  readonly projectGitStatus: Readonly<Record<ProjectId, WorkspaceGitStatus>>;
  readonly projectCheckoutPulling: Readonly<Record<ProjectId, boolean>>;
  readonly projectFetchedAt: Readonly<Record<ProjectId, number>>;
  readonly projectCheckoutResult: Readonly<Record<ProjectId, ProjectCheckoutUpdate>>;
};

export const projectsInitialState: ProjectsState = {
  projects: [],
  projectGitStatus: {},
  projectCheckoutPulling: {},
  projectFetchedAt: {},
  projectCheckoutResult: {},
};
