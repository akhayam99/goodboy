import type { WorkspaceId } from '@goodboy/types';
import { workspaceFolder, type FolderRoot } from '../../../features/terminal/workspaceFolder';
import type { AppStore } from '../../store';

type FolderParams = {
  readonly state: Pick<AppStore, 'projects' | 'terminalFolderOverrides'>;
  readonly workspaceId: WorkspaceId;
  readonly home: string | null;
};

export const selectTerminalWorkspaceFolder = ({
  state,
  workspaceId,
  home,
}: FolderParams): string | null => {
  const roots: FolderRoot[] = state.projects
    .filter((project) => project.workspaceId === workspaceId)
    .map((project) => ({ path: project.rootPath, isStarred: project.starredAt !== undefined }));
  return workspaceFolder({
    roots,
    home,
    override: state.terminalFolderOverrides[workspaceId] ?? null,
  });
};
