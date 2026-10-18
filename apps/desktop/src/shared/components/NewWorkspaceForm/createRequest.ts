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
    if (folder.kind === 'repository' && folder.scope === 'folder' && folder.snappedFrom !== null) {
      created.push({ kind: 'plain', rootPath: folder.snappedFrom, purpose: 'documents' });
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
    if (folder.purpose === 'code' && folder.isGitInit) {
      created.push({ kind: 'git-init', rootPath: folder.path });
      continue;
    }
    created.push({
      kind: 'plain',
      rootPath: folder.path,
      ...(folder.purpose !== null && { purpose: folder.purpose }),
    });
  }
  return { folders: created, moves };
};
