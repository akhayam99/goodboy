import type { Project, WorkspaceId } from '@goodboy/types';
import { mountCardOf, type MountCard } from './mountCardOf';
import type { ProjectAskMount } from './projectAskOf';

export type KnownMount = Readonly<{
  project: Project;
  card: MountCard;
}>;

type Params = {
  readonly candidates: ReadonlyArray<Project>;
  readonly workspaceId: WorkspaceId | null;
  readonly mount: ProjectAskMount | null;
};

export const knownMountOf = ({ candidates, workspaceId, mount }: Params): KnownMount | null => {
  if (mount === null || workspaceId === null) {
    return null;
  }
  const wanted = mount.project.toLowerCase();
  const matches = candidates.filter(
    (project) =>
      project.workspaceId === workspaceId &&
      project.kind === 'repo' &&
      project.name.toLowerCase() === wanted,
  );
  const project = matches[0];
  if (project === undefined || matches.length > 1) {
    return null;
  }
  return {
    project,
    card: mountCardOf({
      project: project.name,
      branch: mount.branch,
      baseBranch: project.baseBranch ?? null,
    }),
  };
};
