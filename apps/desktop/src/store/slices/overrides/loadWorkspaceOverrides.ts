import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

export const loadWorkspaceOverrides = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const overrides = await invokeCommand<OverrideSettings | null>('get_workspace_overrides', {
      workspaceId,
    });
    if (overrides) {
      set((state) => ({
        workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
      }));
    }
  };
};
