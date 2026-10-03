import type { ProviderId, WorkspaceId } from '@goodboy/types';
import type { GetFn } from './types';

export const setWorkspaceProviderBinding = (get: GetFn) => {
  return async (
    workspaceId: WorkspaceId,
    providerId: ProviderId,
    credentialId: string | null,
  ): Promise<void> => {
    const bindings = { ...(get().workspaceOverrides[workspaceId]?.providerBindings ?? {}) };
    if (credentialId === null) {
      delete bindings[providerId];
    }
    if (credentialId !== null) {
      bindings[providerId] = credentialId;
    }
    await get().patchWorkspaceOverrides({
      workspaceId,
      patch: { providerBindings: Object.keys(bindings).length > 0 ? bindings : null },
    });
  };
};
