import type { MountId, Project, SessionProjectMount } from '@goodboy/types';
import { projectById } from '../../store/slices/projects/projectIndex';

export type WorktreeTab = {
  readonly mountId: MountId;
  readonly label: string;
  readonly path: string;
  readonly branch: string;
};

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Pick<Project, 'id' | 'name'>>;
};

export const worktreeTabsOf = ({ mounts, projects }: Params): ReadonlyArray<WorktreeTab> => {
  const named = mounts
    .filter((mount) => mount.isAttached && mount.diskState === 'present')
    .filter(
      (mount, index, attached) =>
        attached.findIndex((candidate) => candidate.mountId === mount.mountId) === index,
    )
    .map((mount) => ({
      mount,
      name: projectById(projects, mount.projectId)?.name ?? mount.mountName,
    }));
  return named.map(({ mount, name }) => ({
    mountId: mount.mountId,
    label:
      named.filter((candidate) => candidate.name === name).length > 1
        ? `${name} · ${mount.branch}`
        : name,
    path: mount.worktreePath,
    branch: mount.branch,
  }));
};
