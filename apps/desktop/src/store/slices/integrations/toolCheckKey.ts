import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly tool: IntegrationBinding['provider'];
};

export const toolCheckKey = ({ workspaceId, tool }: Params): string => `${workspaceId}:${tool}`;
