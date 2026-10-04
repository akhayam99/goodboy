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

export const createWorkspaceTasksSlice = ({ set, get }: SliceDeps): WorkspaceTasksSlice => ({
  ...workspaceTasksInitialState,
  loadWorkspaceExternalTasks: async ({ workspaceId }) => {
    await reload(set, workspaceId);
  },
  linkWorkspaceExternalTask: async ({ task }) => {
    await upsertWorkspaceExternalTask({ db: tauriDatabase, task });
    await reload(set, task.workspaceId);
  },
  unlinkWorkspaceExternalTask: async ({ workspaceId, provider, externalId }) => {
    const task = (get().workspaceExternalTasks[workspaceId] ?? []).find(
      (row) => row.provider === provider && row.externalId === externalId,
    );
    if (task === undefined) {
      return;
    }
    await deleteWorkspaceExternalTask({ db: tauriDatabase, workspaceId, provider, externalId });
    set((state) => ({
      workspaceExternalTasks: {
        ...state.workspaceExternalTasks,
        [workspaceId]: (state.workspaceExternalTasks[workspaceId] ?? []).filter(
          (row) => row.provider !== provider || row.externalId !== externalId,
        ),
      },
    }));
    get().undoable({
      message: `Stopped tracking ${task.identifier}`,
      conflictMessage: `${task.identifier} is already tracked. Nothing changed.`,
      undo: async () => {
        const result = await tauriDatabase.transaction({
          statements: [
            {
              sql: 'SELECT 1 FROM workspace_external_tasks WHERE workspace_id = ? AND provider = ? AND external_id = ?',
              params: [workspaceId, provider, externalId],
              abortWhen: 'rows',
              abortCode: 'task_changed',
            },
            {
              sql: 'INSERT INTO workspace_external_tasks (workspace_id, provider, external_id, identifier, url, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              params: [
                workspaceId,
                provider,
                externalId,
                task.identifier,
                task.url,
                task.title,
                Date.parse(task.createdAt),
              ],
            },
          ],
        });
        if (result.status !== 'committed') {
          return false;
        }
        set((state) => ({
          workspaceExternalTasks: {
            ...state.workspaceExternalTasks,
            [workspaceId]: [...(state.workspaceExternalTasks[workspaceId] ?? []), task],
          },
        }));
        return true;
      },
    });
  },
});
