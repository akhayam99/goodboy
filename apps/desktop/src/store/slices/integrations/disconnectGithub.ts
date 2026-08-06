import type { WorkspaceId } from '@goodboy/types';
import { ghClearToken } from '../../../features/github/github';

type DisconnectParams = {
  readonly workspaceId: WorkspaceId;
};

export const disconnectGithub = () => {
  return async ({ workspaceId }: DisconnectParams): Promise<void> => {
    await ghClearToken(workspaceId);
  };
};
