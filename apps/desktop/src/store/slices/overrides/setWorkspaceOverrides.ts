import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';
import type { WorkspaceWriteQueue } from './workspaceWriteQueue';

export const setWorkspaceOverrides = (set: SetFn, get: GetFn, enqueue: WorkspaceWriteQueue) => {
  return async (workspaceId: WorkspaceId, overrides: OverrideSettings) => {
    const previous = get().workspaceOverrides[workspaceId];
    set((state) => ({
      workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
    }));
    try {
      await enqueue({
        workspaceId,
        write: () =>
          invokeCommand('set_workspace_overrides', {
            workspaceId,
            overrides: get().workspaceOverrides[workspaceId] ?? overrides,
          }),
      });
    } catch (error) {
      set((state) => {
        if (state.workspaceOverrides[workspaceId] !== overrides) {
          return {};
        }
        const workspaceOverrides = { ...state.workspaceOverrides };
        if (previous == null) {
          delete workspaceOverrides[workspaceId];
        }
        if (previous != null) {
          workspaceOverrides[workspaceId] = previous;
        }
        return { workspaceOverrides };
      });
      throw error;
    }
  };
};
