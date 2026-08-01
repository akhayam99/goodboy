import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type Input = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const setSessionActiveMount = ({ set }: Params) => {
  return ({ sessionId, workspaceId }: Input): void => {
    set((state) => ({
      sessionActiveMount: { ...state.sessionActiveMount, [sessionId]: workspaceId },
    }));
  };
};
