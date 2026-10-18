import type { ProjectId, WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../../../store/types';
import { folderGitRowOf, type FolderGitRow } from './folderGitRowOf';

type Params = {
  readonly state: Pick<
    AppState,
    | 'projects'
    | 'folderGit'
    | 'folderGitNotice'
    | 'folderGitChoice'
    | 'folderPurpose'
    | 'bootstrapPhase'
  >;
  readonly workspaceId: WorkspaceId;
  readonly rows?: ReadonlyArray<FolderGitRow>;
};

export const folderGitCardIds = ({ state, workspaceId, rows }: Params): ReadonlyArray<ProjectId> =>
  state.projects
    .filter((project) => {
      if (project.workspaceId !== workspaceId) {
        return false;
      }
      const notice = state.folderGitNotice[project.id] ?? null;
      const stage = state.bootstrapPhase[project.id]?.stage;
      const row = folderGitRowOf({
        project,
        purpose: state.folderPurpose[project.id] ?? null,
        probe: state.folderGit[project.id] ?? null,
        choice: state.folderGitChoice[project.id] ?? null,
        notice,
        isFirstLap: stage === 'first-lap' || stage === 'moving',
      });
      if (rows !== undefined) {
        return rows.includes(row);
      }
      return notice !== null || row !== 'hidden';
    })
    .map((project) => project.id);
