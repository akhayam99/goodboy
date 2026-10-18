import type { Project, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly state: Pick<AppState, 'sessions' | 'projects' | 'sessionProjectMounts'>;
  readonly sessionId: SessionId;
};

type HistoryParams = {
  readonly state: Pick<
    AppState,
    'sessions' | 'projects' | 'sessionProjectMounts' | 'sessionFolderTurns'
  >;
  readonly sessionId: SessionId;
};

const unmountedWorkspaceProjects = ({ state, sessionId }: Params): ReadonlyArray<Project> => {
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return [];
  }
  const mounts = state.sessionProjectMounts[sessionId] ?? [];
  return state.projects.filter(
    (project) =>
      project.workspaceId === session.workspaceId &&
      !mounts.some((mount) => mount.projectId === project.id),
  );
};

export const inPlaceFoldersOf = ({ state, sessionId }: Params): ReadonlyArray<Project> =>
  unmountedWorkspaceProjects({ state, sessionId }).filter((project) => project.kind === 'folder');

export const historyCandidatesOf = ({ state, sessionId }: Params): ReadonlyArray<Project> =>
  unmountedWorkspaceProjects({ state, sessionId });

export const historyFoldersOf = ({ state, sessionId }: HistoryParams): ReadonlyArray<Project> => {
  const turns = state.sessionFolderTurns[sessionId] ?? [];
  return unmountedWorkspaceProjects({ state, sessionId }).filter(
    (project) =>
      project.kind === 'folder' ||
      turns.some((turn) => turn.folderId === project.id || turn.folderPath === project.rootPath),
  );
};
