import type { SessionProjectMount } from '@goodboy/types';
import { worktreeDepsCheck } from '../../../../../shared/lib/worktreeDepsCheck';

type Target = Pick<SessionProjectMount, 'repoRoot' | 'worktreePath'>;

type Params = {
  readonly targets: ReadonlyArray<Target>;
};

type TargetParams = {
  readonly target: Target;
};

const OUTSIDE_LINE = 'is linked to another folder: reinstall before the agent runs checks.';

const outsideFolderOf = async ({ target }: TargetParams): Promise<string | null> => {
  if (target.worktreePath === '' || target.repoRoot === '') {
    return null;
  }
  try {
    const check = await worktreeDepsCheck({
      repoPath: target.repoRoot,
      worktreePath: target.worktreePath,
    });
    return check.state === 'outside' ? (check.folder ?? 'node_modules') : null;
  } catch {
    return null;
  }
};

export const startDepsLineOf = async ({ targets }: Params): Promise<string | null> => {
  const folders = await Promise.all(targets.map((target) => outsideFolderOf({ target })));
  const [first] = folders.filter((folder): folder is string => folder !== null);
  return first === undefined ? null : `${first} ${OUTSIDE_LINE}`;
};
