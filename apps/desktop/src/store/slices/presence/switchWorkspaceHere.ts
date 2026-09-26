import type { WorkspaceId } from '@goodboy/types';
import { setWindowTitle } from '../../../features/workspace/window';
import type { GetFn } from './types';

type Params = {
  readonly id: WorkspaceId;
  readonly title: string;
};

export const switchWorkspaceHere = (get: GetFn) => {
  return async ({ id, title }: Params): Promise<void> => {
    await get().setCurrentWorkspace(id);
    void setWindowTitle(title);
  };
};
