import { invoke } from '@tauri-apps/api/core';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export const setWorkspaceOverrides = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId, overrides: OverrideSettings) => {
    const previous = get().workspaceOverrides[workspaceId];
    set((state) => ({
      workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
    }));
    try {
      await invoke('set_workspace_overrides', { workspaceId, overrides });
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
