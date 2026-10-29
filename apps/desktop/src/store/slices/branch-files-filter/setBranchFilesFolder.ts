import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type SetParams = {
  readonly sessionId: SessionId;
  readonly folder: string | null;
};

export const setBranchFilesFolder =
  ({ set }: Params) =>
  ({ sessionId, folder }: SetParams): void => {
    set((state) => {
      if ((state.branchFilesFolder[sessionId] ?? null) === folder) {
        return {};
      }
      return { branchFilesFolder: { ...state.branchFilesFolder, [sessionId]: folder } };
    });
  };
