import {
  deleteWorkspaceExternalTask,
  listWorkspaceExternalTasks,
  upsertWorkspaceExternalTask,
} from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SliceDeps } from '../../slice-types';
import { workspaceTasksInitialState } from './state';
import type { SetFn, WorkspaceTasksSlice } from './types';

const reload = async (set: SetFn, workspaceId: WorkspaceId): Promise<void> => {
  const tasks = await listWorkspaceExternalTasks({ db: tauriDatabase, workspaceId });
  set((state) => ({
    workspaceExternalTasks: { ...state.workspaceExternalTasks, [workspaceId]: tasks },
  }));
};

export const createWorkspaceTasksSlice = ({ set }: SliceDeps): WorkspaceTasksSlice => ({
  ...workspaceTasksInitialState,
  loadWorkspaceExternalTasks: async ({ workspaceId }) => {
    await reload(set, workspaceId);
  },
  linkWorkspaceExternalTask: async ({ task }) => {
    await upsertWorkspaceExternalTask({ db: tauriDatabase, task });
    await reload(set, task.workspaceId);
  },
  unlinkWorkspaceExternalTask: async ({ workspaceId, provider, externalId }) => {
    await deleteWorkspaceExternalTask({ db: tauriDatabase, workspaceId, provider, externalId });
    await reload(set, workspaceId);
  },
});
