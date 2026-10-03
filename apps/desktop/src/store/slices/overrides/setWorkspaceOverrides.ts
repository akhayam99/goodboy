import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';
import type { WorkspaceWriteQueue } from './workspaceWriteQueue';

export const setWorkspaceOverrides = (
  set: SetFn,
  get: GetFn,
  enqueue: WorkspaceWriteQueue<OverrideSettings>,
) => {
  return async (workspaceId: WorkspaceId, overrides: OverrideSettings) => {
    const previous = get().workspaceOverrides[workspaceId];
    set((state) => ({
      workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
    }));
    const outcome = await enqueue({
      workspaceId,
      payload: overrides,
      previous,
      persist: (payload) =>
        invokeCommand('set_workspace_overrides', { workspaceId, overrides: payload }),
    });
    if (outcome.ok) {
      return;
    }
    const { rollback } = outcome;
    set((state) => {
      if (state.workspaceOverrides[workspaceId] !== overrides) {
        return {};
      }
      const workspaceOverrides = { ...state.workspaceOverrides };
      if (rollback == null) {
        delete workspaceOverrides[workspaceId];
      }
      if (rollback != null) {
        workspaceOverrides[workspaceId] = rollback;
      }
      return { workspaceOverrides };
    });
    throw outcome.error;
  };
};
