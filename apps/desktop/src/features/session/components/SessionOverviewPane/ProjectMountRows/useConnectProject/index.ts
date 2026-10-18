import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { GitRepoCheck, Project, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { usePickFolder } from '../../../../../../shared/hooks/usePickFolder';
import { scanChildRepos, validateGitRepo } from '../../../../../../shared/lib/repo';

export type ConnectFailure =
  | { readonly kind: 'children' }
  | { readonly kind: 'conflict'; readonly projectName: string; readonly workspaceName: string }
  | { readonly kind: 'error'; readonly message: string };

type Params = {
  readonly workspaceId: WorkspaceId;
};

type CheckParams = {
  readonly check: GitRepoCheck;
};

const REASON = {
  permission_denied: "Goodboy can't read that folder.",
  not_found: 'That folder is not there anymore.',
  not_a_directory: 'That is a file, not a folder.',
  git_failed: "Git couldn't read that folder.",
} as const;

const reasonOf = ({ check }: CheckParams): string | null => {
  switch (check.errorKind) {
    case 'permission_denied':
    case 'not_found':
    case 'not_a_directory':
    case 'git_failed':
      return check.error ?? REASON[check.errorKind];
    case 'not_a_repository':
    case null:
      return null;
    default: {
      const unreachable: never = check.errorKind;
      return unreachable;
    }
  }
};

export type ConnectProject = {
  readonly isBusy: boolean;
  readonly failure: ConnectFailure | null;
  readonly connect: () => Promise<Project | null>;
};

export const useConnectProject = ({ workspaceId }: Params): ConnectProject => {
  const pickFolder = usePickFolder();
  const addProject = useAppStore((state) => state.addProject);
  const [isBusy, setIsBusy] = useState(false);
  const [failure, setFailure] = useState<ConnectFailure | null>(null);

  const connect = async (): Promise<Project | null> => {
    setFailure(null);
    const picked = await pickFolder();
    if (picked === null) {
      return null;
    }
    setIsBusy(true);
    try {
      const check = await validateGitRepo(picked);
      const reason = reasonOf({ check });
      if (reason !== null) {
        setFailure({ kind: 'error', message: reason });
        return null;
      }
      const isRepo = check.isRepo && check.rootPath !== null && check.rootPath !== '';
      if (!isRepo) {
        const children = await scanChildRepos({ path: check.resolvedPath ?? picked });
        if (children.length > 0) {
          setFailure({ kind: 'children' });
          return null;
        }
      }
      const result = await addProject({ workspaceId, rootPath: picked });
      if (result.kind === 'conflict') {
        setFailure({
          kind: 'conflict',
          projectName: result.conflict.project.name,
          workspaceName: result.conflict.sourceWorkspace.name,
        });
        return null;
      }
      return result.project;
    } catch (error) {
      setFailure({ kind: 'error', message: formatError(error) });
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  return { isBusy, failure, connect };
};
