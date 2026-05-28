import { invoke } from '@tauri-apps/api/core';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

export function loadWorkspaceOverrides(set: SetFn) {
  return async (workspaceId: WorkspaceId) => {
    const overrides = await invoke<OverrideSettings | null>('get_workspace_overrides', {
      workspaceId,
    });
    if (overrides) {
      set((state) => ({
        workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
      }));
    }
  };
}
