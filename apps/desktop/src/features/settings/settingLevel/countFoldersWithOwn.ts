import type { OverrideSettings, Project, WorkspaceId } from '@goodboy/types';
import { OVERRIDE_REACH } from './overrideReach';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly workspaceId: WorkspaceId;
  readonly key: keyof OverrideSettings;
};

export const countFoldersWithOwn = ({ projects, workspaceId, key }: Params): number => {
  const reach: ReadonlyArray<string> = OVERRIDE_REACH[key];
  if (!reach.includes('project')) {
    return 0;
  }
  return projects.filter(
    (project) =>
      project.workspaceId === workspaceId &&
      project.disconnectedAt == null &&
      project.overrides[key] != null,
  ).length;
};
