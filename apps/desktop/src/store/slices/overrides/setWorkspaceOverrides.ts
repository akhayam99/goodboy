import { invoke } from '@tauri-apps/api/core';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

export const setWorkspaceOverrides = (set: SetFn) => {
  return async (workspaceId: WorkspaceId, overrides: OverrideSettings) => {
    await invoke('set_workspace_overrides', { workspaceId, overrides });
    set((state) => ({
      workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
    }));
  };
};
