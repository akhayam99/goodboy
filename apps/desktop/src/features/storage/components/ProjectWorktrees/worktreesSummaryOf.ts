import { formatBytes } from '../../../../shared/utils/formatBytes';
import { NAMES } from '../../../../shared/utils/names';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { ProjectWorktrees } from '../../../track/tracksOfWorkspace';

type Params = {
  readonly worktrees: Pick<ProjectWorktrees, 'count' | 'sizeBytes'>;
};

export const worktreesSummaryOf = ({ worktrees }: Params): string => {
  if (worktrees.count === 0) {
    return NAMES.worktrees;
  }
  const count = pluralize(worktrees.count, 'worktree');
  return worktrees.sizeBytes === null
    ? count
    : `${count} · ${formatBytes({ bytes: worktrees.sizeBytes })}`;
};
