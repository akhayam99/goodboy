import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';

type Params = {
  readonly provider: WorkspaceIntegrationProvider;
  readonly fromWorkspaceId: WorkspaceId;
  readonly toWorkspaceId: WorkspaceId;
};

export const reuseIntegrationCredential = async ({
  provider,
  fromWorkspaceId,
  toWorkspaceId,
}: Params): Promise<void> => {
  await invoke('integration_credential_reuse', { provider, fromWorkspaceId, toWorkspaceId });
};
