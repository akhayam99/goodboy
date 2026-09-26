import { invoke } from '@tauri-apps/api/core';

type Params = {
  readonly url: string;
};

export const loadRemoteImage = async ({ url }: Params): Promise<string> => {
  return invoke<string>('fetch_remote_image', { url });
};

export type ToolImageProvider = 'linear' | 'jira' | 'github';

type ToolImageParams = {
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly provider: ToolImageProvider;
  readonly email?: string | null;
  readonly url: string;
};

export const loadToolImage = async ({
  workspaceId,
  projectId,
  provider,
  email,
  url,
}: ToolImageParams): Promise<string> => {
  return invoke<string>('load_tool_image', {
    workspaceId,
    projectId: projectId ?? null,
    provider,
    email: email ?? null,
    url,
  });
};
