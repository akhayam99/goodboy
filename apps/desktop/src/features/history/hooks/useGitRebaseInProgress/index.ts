import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { useWorktreeTree } from '../useWorktreeTree';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
};

export const useGitRebaseInProgress = ({ sessionId, worktreePath }: Params): boolean => {
  const baseBranch = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );
  const status = useWorktreeTree({ worktreePath, baseBranch });
  return status?.inProgress === 'rebase';
};
