import type {
  SessionExternalTaskProvider,
  WorkspaceExternalTask,
  WorkspaceId,
} from '@goodboy/types';
import type { WorkspaceTasksState } from './state';

export type { SetFn } from '../../slice-types';

type WorkspaceParams = {
  readonly workspaceId: WorkspaceId;
};

type LinkParams = {
  readonly task: WorkspaceExternalTask;
};

type UnlinkParams = WorkspaceParams & {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
};

export type WorkspaceTasksSlice = WorkspaceTasksState & {
  loadWorkspaceExternalTasks(params: WorkspaceParams): Promise<void>;
  linkWorkspaceExternalTask(params: LinkParams): Promise<void>;
  unlinkWorkspaceExternalTask(params: UnlinkParams): Promise<void>;
};
