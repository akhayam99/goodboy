import type { WorkspaceId } from '@goodboy/types';

type EnqueueParams = {
  readonly workspaceId: WorkspaceId;
  readonly write: () => Promise<void>;
};

export type WorkspaceWriteQueue = (params: EnqueueParams) => Promise<void>;

export const createWorkspaceWriteQueue = (): WorkspaceWriteQueue => {
  const tails = new Map<WorkspaceId, Promise<void>>();
  return ({ workspaceId, write }) => {
    const previous = tails.get(workspaceId) ?? Promise.resolve();
    const next = previous.then(write, write);
    tails.set(workspaceId, next);
    const release = () => {
      if (tails.get(workspaceId) === next) {
        tails.delete(workspaceId);
      }
    };
    next.then(release, release);
    return next;
  };
};
