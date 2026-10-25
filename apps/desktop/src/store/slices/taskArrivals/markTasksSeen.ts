import type { WorkspaceId } from '@goodboy/types';
import { markSeenAt } from '../../../features/inbox/taskArrivals';
import { readTaskArrivals, writeTaskArrivals } from '../../../features/inbox/taskArrivalsStorage';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const markTasksSeen = ({ set, get }: SliceDeps) => {
  return ({ workspaceId }: Params): void => {
    const before = get().taskArrivals[workspaceId] ?? readTaskArrivals({ workspaceId });
    const arrivals = markSeenAt({ arrivals: before, now: Date.now() });
    writeTaskArrivals({ workspaceId, arrivals });
    set((current) => ({
      taskArrivals: { ...current.taskArrivals, [workspaceId]: arrivals },
      taskNewKeys: { ...current.taskNewKeys, [workspaceId]: [] },
    }));
  };
};
