import type { Project, SessionMountView, SessionProjectMount } from '@goodboy/types';
import { projectById } from '../../store/slices/projects/projectIndex';
import { resolveWriteDestination } from '../../store/slices/project-mounts/writeDestination';

export type ExploreTarget =
  | {
      readonly kind: 'mount';
      readonly path: string;
      readonly projectName: string;
      readonly branch: string;
    }
  | { readonly kind: 'root'; readonly path: string; readonly projectName: string }
  | { readonly kind: 'scratch'; readonly path: string }
  | {
      readonly kind: 'gone';
      readonly path: string;
      readonly projectName: string;
      readonly branch: string;
    }
  | { readonly kind: 'none' };

type Params = {
  readonly requestedPath: string | null;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly views: ReadonlyArray<SessionMountView>;
  readonly fallback: SessionProjectMount | null;
  readonly projects: ReadonlyArray<Project>;
  readonly firstLapProject: Project | null;
  readonly scratchPath: string | null;
};

type NameParams = {
  readonly projects: ReadonlyArray<Project>;
  readonly projectId: string;
  readonly mountName: string;
};

const projectNameOf = ({ projects, projectId, mountName }: NameParams): string =>
  projectById(projects, projectId)?.name ?? mountName;

type GoneParams = {
  readonly requestedPath: string;
  readonly views: ReadonlyArray<SessionMountView>;
};

const goneViewOf = ({ requestedPath, views }: GoneParams): SessionMountView | null =>
  views.find(
    (view) =>
      (view.diskState === 'missing' || view.diskState === 'removed') &&
      (view.worktreePath === requestedPath || view.lastWorktreePath === requestedPath),
  ) ?? null;

export const selectExploreMount = ({
  requestedPath,
  mounts,
  views,
  fallback,
  projects,
  firstLapProject,
  scratchPath,
}: Params): ExploreTarget => {
  const asked = requestedPath === null || requestedPath === '' ? null : requestedPath;
  const requested =
    asked === null ? null : (mounts.find((mount) => mount.worktreePath === asked) ?? null);
  const gone =
    asked === null || requested !== null ? null : goneViewOf({ requestedPath: asked, views });
  if (asked !== null && gone !== null) {
    return {
      kind: 'gone',
      path: asked,
      projectName: projectNameOf({
        projects,
        projectId: gone.projectId,
        mountName: gone.mountName,
      }),
      branch: gone.branch,
    };
  }
  const mount = requested ?? fallback;
  const destination = resolveWriteDestination({
    mount,
    projectName:
      mount === null
        ? null
        : projectNameOf({ projects, projectId: mount.projectId, mountName: mount.mountName }),
    scratchPath,
    root:
      firstLapProject === null
        ? null
        : {
            projectId: firstLapProject.id,
            projectName: firstLapProject.name,
            path: firstLapProject.rootPath,
            branch: '',
          },
  });
  if (destination.kind === 'mount') {
    if (destination.worktreePath.trim() === '') {
      return { kind: 'none' };
    }
    return {
      kind: 'mount',
      path: destination.worktreePath,
      projectName: destination.projectName,
      branch: destination.branch,
    };
  }
  if (destination.kind === 'root') {
    return { kind: 'root', path: destination.path, projectName: destination.projectName };
  }
  if (destination.path === null || destination.path.trim() === '') {
    return { kind: 'none' };
  }
  return { kind: 'scratch', path: destination.path };
};
