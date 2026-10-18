import type { Project, WorkspaceId } from '@goodboy/types';
import { tildePath } from '../../shared/components/NewWorkspaceForm/tildePath';
import { primaryProjectRoot } from './primaryProjectRoot';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly workspaceId: WorkspaceId;
  readonly home: string | null;
};

type RootsParams = {
  readonly roots: ReadonlyArray<string>;
};

const commonParent = ({ roots }: RootsParams): string => {
  const [first = [], ...rest] = roots.map((root) => root.split('/'));
  const shared = first.filter((segment, index) =>
    rest.every((parts) => first.slice(0, index + 1).every((part, at) => parts[at] === part)),
  );
  return shared.join('/');
};

export const workspaceFolderPath = ({ projects, workspaceId, home }: Params): string | null => {
  const owned = projects.filter(
    (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
  );
  if (owned.length === 0) {
    return null;
  }
  const parent = commonParent({ roots: owned.map((project) => project.rootPath) });
  const isTooWide = parent === '' || parent === home;
  const path = isTooWide ? primaryProjectRoot({ projects: owned, workspaceId }) : parent;
  return path === null ? null : tildePath({ path, home });
};
