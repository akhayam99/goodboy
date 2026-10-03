import type { Project, Workspace, WorkspaceId } from '@goodboy/types';

export const sortWorkspacesByRecent = (
  list: ReadonlyArray<Workspace>,
): ReadonlyArray<Workspace> => {
  return [...list].sort((a, b) => {
    const at = a.lastAccessedAt ?? '';
    const bt = b.lastAccessedAt ?? '';
    if (at !== bt) {
      return at < bt ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
};

type DigitParams = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly currentId: WorkspaceId | null;
  readonly limit: number;
};

export const workspacesByDigit = ({
  workspaces,
  currentId,
  limit,
}: DigitParams): ReadonlyArray<Workspace> =>
  sortWorkspacesByRecent(workspaces.filter((workspace) => workspace.id !== currentId)).slice(
    0,
    limit,
  );

type FilterParams = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly projects: ReadonlyArray<Project>;
  readonly query: string;
};

export const filterWorkspaces = ({
  workspaces,
  projects,
  query,
}: FilterParams): ReadonlyArray<Workspace> => {
  const q = query.trim().toLowerCase();
  if (!q) {
    return workspaces;
  }
  return workspaces.filter(
    (workspace) =>
      workspace.name.toLowerCase().includes(q) ||
      projects.some(
        (project) =>
          project.workspaceId === workspace.id && project.rootPath.toLowerCase().includes(q),
      ),
  );
};
