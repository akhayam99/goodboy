import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { overridesFromWire, type WireOverrides } from './overridesFromWire';
import type { WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

export const loadWorkspaceOverrides = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const wire = await invokeCommand<WireOverrides | null>('get_workspace_overrides', {
      workspaceId,
    });
    if (wire == null) {
      return;
    }
    const overrides = overridesFromWire({ wire });
    set((state) => ({
      workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
    }));
  };
};
