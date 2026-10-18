import { draftFolders } from './draftFolders';
import type { FolderEntry, FolderProblem } from './folderEntry';

type Params = {
  readonly folders: ReadonlyArray<FolderEntry>;
  readonly name: string | null;
};

const PROBLEM_REASON = {
  permission_denied: 'Allow access or choose another folder.',
  not_found: 'Choose another folder.',
  not_a_directory: 'Choose a folder, not a file.',
  git_failed: 'Try again or choose another folder.',
} as const satisfies Record<FolderProblem, string>;

export const createBlock = ({ folders, name }: Params): string | null => {
  const included = draftFolders({ folders });
  if (included.length === 0) {
    return 'Choose a folder for the workspace.';
  }
  for (const folder of included) {
    if (folder.kind === 'unreadable') {
      return PROBLEM_REASON[folder.problem];
    }
    if (folder.conflict === null) {
      continue;
    }
    if (folder.conflict.choice === 'ask') {
      return `Move ${folder.name} here or leave it out.`;
    }
    if (folder.conflict.runningAgentCount > 0) {
      return `Stop the agents in ${folder.conflict.workspaceName} before moving ${folder.name}.`;
    }
  }
  if (name !== null && name.trim() === '') {
    return 'Name the workspace.';
  }
  return null;
};
