import { parseProviderPolicy } from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

type WireOverrides = Omit<OverrideSettings, 'providerPool'> & {
  readonly providerPool?: unknown;
};

export const loadWorkspaceOverrides = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const wire = await invokeCommand<WireOverrides | null>('get_workspace_overrides', {
      workspaceId,
    });
    if (wire == null) {
      return;
    }
    const overrides: OverrideSettings = {
      ...wire,
      providerPool: parseProviderPolicy({
        value: wire.providerPool,
        defaultProviderId: wire.defaultProviderId,
      }),
    };
    set((state) => ({
      workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
    }));
  };
};
