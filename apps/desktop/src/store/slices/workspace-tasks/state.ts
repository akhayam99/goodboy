import type { WorkspaceExternalTask, WorkspaceId } from '@goodboy/types';

export type WorkspaceTasksState = {
  readonly workspaceExternalTasks: Readonly<
    Record<WorkspaceId, ReadonlyArray<WorkspaceExternalTask>>
  >;
};

export const workspaceTasksInitialState: WorkspaceTasksState = {
  workspaceExternalTasks: {},
};
