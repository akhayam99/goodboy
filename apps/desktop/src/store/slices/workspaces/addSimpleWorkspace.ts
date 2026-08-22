import type { Workspace } from '@goodboy/types';
import { prepareSimpleWorkspace } from '../../../features/workspace/prepareSimpleWorkspace';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly name: string;
  readonly path: string;
};

export const addSimpleWorkspace = (_set: SetFn, get: GetFn) => {
  return async ({ name, path }: Input): Promise<Workspace> => {
    const trimmedName = name.trim();
    const trimmedPath = path.trim();
    if (trimmedName.length === 0) {
      throw new Error('workspace name cannot be empty');
    }
    if (trimmedPath.length === 0) {
      throw new Error('workspace directory cannot be empty');
    }
    const rootPath = await prepareSimpleWorkspace({ path: trimmedPath });
    return get().addWorkspace({ rootPath, name: trimmedName });
  };
};
