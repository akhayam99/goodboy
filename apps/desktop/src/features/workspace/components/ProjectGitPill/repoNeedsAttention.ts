import type { WorkspaceGitStatus } from '@goodboy/types';
import { projectGitRowStatusOf } from '../../../../shared/lib/projectGitPresentation';

type Params = {
  readonly status: WorkspaceGitStatus | null;
};

export const repoNeedsAttention = ({ status }: Params): boolean => {
  if (status === null) {
    return false;
  }
  if (status.state !== 'ready') {
    return true;
  }
  const { kind } = projectGitRowStatusOf({ status });
  switch (kind) {
    case 'behind':
    case 'uncommitted':
    case 'diverged':
    case 'rebase-stopped':
    case 'cant-read':
      return true;
    case 'up-to-date':
    case 'no-upstream':
    case 'detached':
      return false;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};
