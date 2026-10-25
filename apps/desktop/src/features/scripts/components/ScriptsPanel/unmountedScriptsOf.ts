import type { ProjectId } from '@goodboy/types';
import type { SessionScriptGroup } from '../../buildSessionScripts';
import type { UnmountedScriptsEntry } from './UnmountedScriptsNote';

type ProjectLike = {
  readonly id: ProjectId;
  readonly name: string;
};

type Params = {
  readonly groups: ReadonlyArray<SessionScriptGroup>;
  readonly saved: ReadonlyArray<{ readonly projectId: ProjectId }>;
  readonly projects: ReadonlyArray<ProjectLike>;
};

export const unmountedScriptsOf = ({
  groups,
  saved,
  projects,
}: Params): ReadonlyArray<UnmountedScriptsEntry> => {
  const mounted = new Set(groups.map((group) => group.projectId));
  return projects.flatMap((project) => {
    if (mounted.has(project.id)) {
      return [];
    }
    const count = saved.filter((script) => script.projectId === project.id).length;
    return count === 0 ? [] : [{ projectName: project.name, count }];
  });
};
