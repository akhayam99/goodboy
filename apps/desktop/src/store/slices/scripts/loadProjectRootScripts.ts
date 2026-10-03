import { formatError } from '@goodboy/ui';
import { scanProjectScripts } from '../../../features/scripts/scripts';
import type { ProjectRootScripts } from './state';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly rootPath: string;
};

const put = ({
  set,
  rootPath,
  entry,
}: {
  readonly set: SetFn;
  readonly rootPath: string;
  readonly entry: ProjectRootScripts;
}): void =>
  set((state) => ({ projectRootScripts: { ...state.projectRootScripts, [rootPath]: entry } }));

export const loadProjectRootScripts = (set: SetFn, get: GetFn) => {
  return async ({ rootPath }: Params): Promise<void> => {
    const current = get().projectRootScripts[rootPath];
    if (current !== undefined && current.status !== 'error') {
      return;
    }
    put({ set, rootPath, entry: { status: 'loading', groups: [], error: null } });
    try {
      const groups = await scanProjectScripts({ worktreePath: rootPath });
      put({ set, rootPath, entry: { status: 'ready', groups, error: null } });
    } catch (caughtError) {
      put({
        set,
        rootPath,
        entry: { status: 'error', groups: [], error: formatError(caughtError) },
      });
    }
  };
};
