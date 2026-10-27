import type { WorkspaceId } from '@goodboy/types';
import type { TaskArrivals } from '../../../features/inbox/taskArrivals';

export type TaskArrivalsState = {
  readonly taskArrivals: Readonly<Record<WorkspaceId, TaskArrivals>>;
  readonly taskNewKeys: Readonly<Record<WorkspaceId, ReadonlyArray<string>>>;
};

export const taskArrivalsInitialState: TaskArrivalsState = {
  taskArrivals: {},
  taskNewKeys: {},
};
