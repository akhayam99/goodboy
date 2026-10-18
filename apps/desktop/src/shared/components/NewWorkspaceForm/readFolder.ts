import type { GitRepoCheck, WorkspaceId } from '@goodboy/types';
import { scanChildRepos, validateGitRepo } from '../../lib/repo';
import { folderName } from '../../../store/slices/terminal/terminalOwner';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import { folderConflictOf } from './folderConflictOf';
import type { FolderEntry, FolderProblem, FoundSummary } from './folderEntry';

type PreviewParams = {
  readonly workspaceId: WorkspaceId | null;
  readonly rootPath: string;
};

type Params = {
  readonly path: string;
  readonly pick: number;
  readonly workspaceId: WorkspaceId;
  readonly preview: (params: PreviewParams) => Promise<ProjectAttachConflict | null>;
};

export type FolderReading = {
  readonly sourcePath: string;
  readonly entries: ReadonlyArray<FolderEntry>;
  readonly found: FoundSummary | null;
};

type CheckParams = {
  readonly check: GitRepoCheck;
};

const problemOf = ({ check }: CheckParams): FolderProblem | null => {
  switch (check.errorKind) {
    case 'permission_denied':
    case 'not_found':
    case 'not_a_directory':
    case 'git_failed':
      return check.errorKind;
    case 'not_a_repository':
    case null:
      return null;
    default: {
      const unreachable: never = check.errorKind;
      return unreachable;
    }
  }
};

type NameParams = {
  readonly path: string;
};

const nameOf = ({ path }: NameParams): string => folderName({ path }) ?? path;

type ConflictParams = {
  readonly entry: FolderEntry;
  readonly workspaceId: WorkspaceId;
  readonly preview: Params['preview'];
};

const withConflict = async ({
  entry,
  workspaceId,
  preview,
}: ConflictParams): Promise<FolderEntry> => {
  if (entry.kind === 'unreadable') {
    return entry;
  }
  const found = await preview({ workspaceId, rootPath: entry.path });
  if (found === null) {
    return entry;
  }
  return { ...entry, conflict: await folderConflictOf({ conflict: found }) };
};

type ReadParams = {
  readonly path: string;
  readonly pick: number;
};

const readEntries = async ({ path, pick }: ReadParams): Promise<FolderReading> => {
  const check = await validateGitRepo(path);
  const resolved = check.resolvedPath ?? path;
  const problem = problemOf({ check });
  if (problem !== null) {
    return {
      sourcePath: resolved,
      entries: [
        {
          kind: 'unreadable',
          path: resolved,
          name: nameOf({ path: resolved }),
          pick,
          isIncluded: true,
          problem,
          detail: check.error,
        },
      ],
      found: null,
    };
  }
  if (check.isRepo && check.rootPath !== null && check.rootPath !== '') {
    return {
      sourcePath: check.rootPath,
      entries: [
        {
          kind: 'repository',
          path: check.rootPath,
          name: nameOf({ path: check.rootPath }),
          pick,
          isIncluded: true,
          defaultBranch: check.defaultBranch,
          snappedFrom: check.rootPath === resolved ? null : resolved,
          conflict: null,
        },
      ],
      found: null,
    };
  }
  const children = await scanChildRepos({ path: resolved });
  if (children.length > 0) {
    return {
      sourcePath: resolved,
      entries: children.map((child) => ({
        kind: 'repository',
        path: child.path,
        name: child.name,
        pick,
        isIncluded: true,
        defaultBranch: child.defaultBranch,
        snappedFrom: null,
        conflict: null,
      })),
      found: { parentName: nameOf({ path: resolved }), repositoryCount: children.length },
    };
  }
  return {
    sourcePath: resolved,
    entries: [
      {
        kind: 'plain',
        path: resolved,
        name: nameOf({ path: resolved }),
        pick,
        isIncluded: true,
        isGitInit: false,
        conflict: null,
      },
    ],
    found: null,
  };
};

export const readFolder = async ({
  path,
  pick,
  workspaceId,
  preview,
}: Params): Promise<FolderReading> => {
  const reading = await readEntries({ path, pick });
  const entries = await Promise.all(
    reading.entries.map((entry) => withConflict({ entry, workspaceId, preview })),
  );
  return { ...reading, entries };
};
