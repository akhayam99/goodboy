import type { Project } from '@goodboy/types';
import { mountCardOf, type MountCard } from './mountCardOf';
import type { ProjectAskMount } from './projectAskOf';

export type KnownMount = Readonly<{
  project: Project;
  card: MountCard;
}>;

type Params = {
  readonly candidates: ReadonlyArray<Project>;
  readonly mount: ProjectAskMount | null;
};

export const knownMountOf = ({ candidates, mount }: Params): KnownMount | null => {
  if (mount === null) {
    return null;
  }
  const wanted = mount.project.toLowerCase();
  for (const project of candidates) {
    if (project.kind === 'repo' && project.name.toLowerCase() === wanted) {
      return {
        project,
        card: mountCardOf({
          project: project.name,
          branch: mount.branch,
          baseBranch: project.baseBranch ?? null,
        }),
      };
    }
  }
  return null;
};
