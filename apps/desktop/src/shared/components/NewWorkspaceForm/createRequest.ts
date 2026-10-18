import type {
  FolderMove,
  NewWorkspaceFolder,
} from '../../../store/slices/workspaces/createWorkspaceWithFolders';
import { draftFolders } from './draftFolders';
import type { FolderEntry } from './folderEntry';

type Params = {
  readonly folders: ReadonlyArray<FolderEntry>;
};

type CreateRequest = {
  readonly folders: ReadonlyArray<NewWorkspaceFolder>;
  readonly moves: ReadonlyArray<FolderMove>;
};

export const createRequest = ({ folders }: Params): CreateRequest => {
  const created: NewWorkspaceFolder[] = [];
  const moves: FolderMove[] = [];
  for (const folder of draftFolders({ folders })) {
    if (folder.kind === 'unreadable') {
      continue;
    }
    if (folder.conflict !== null) {
      if (folder.conflict.choice === 'move') {
        moves.push({
          projectId: folder.conflict.projectId,
          fromWorkspaceId: folder.conflict.workspaceId,
        });
      }
      continue;
    }
    if (folder.kind === 'repository') {
      created.push({
        kind: 'repository',
        rootPath: folder.path,
        defaultBranch: folder.defaultBranch,
      });
      continue;
    }
    created.push({ kind: folder.isGitInit ? 'git-init' : 'plain', rootPath: folder.path });
  }
  return { folders: created, moves };
};
