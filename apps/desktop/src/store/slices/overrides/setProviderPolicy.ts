import { firstOnProvider } from '@goodboy/core';
import type { ProviderPolicy, WorkspaceId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly policy: ProviderPolicy | null;
};

export const setProviderPolicy = (get: GetFn) => {
  return async ({ workspaceId, policy }: Params): Promise<void> => {
    const firstOn = firstOnProvider({ policy });
    await get().patchWorkspaceOverrides({
      workspaceId,
      patch: {
        providerPool: policy,
        ...(firstOn !== null && { defaultProviderId: firstOn }),
      },
    });
  };
};
