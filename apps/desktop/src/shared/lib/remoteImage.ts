import { invokeCommand } from './invokeCommand';

type Params = {
  readonly url: string;
};

export const loadRemoteImage = async ({ url }: Params): Promise<string> => {
  return invokeCommand<string>('fetch_remote_image', { url });
};

const avatarRequests = new Map<string, Promise<string>>();

export const loadAvatarImage = ({ url }: Params): Promise<string> => {
  const known = avatarRequests.get(url);
  if (known != null) {
    return known;
  }
  const request = loadRemoteImage({ url });
  avatarRequests.set(url, request);
  return request;
};

export type ToolImageProvider = 'linear' | 'jira' | 'github';

type ToolImageParams = {
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly provider: ToolImageProvider;
  readonly email?: string | null;
  readonly siteUrl?: string | null;
  readonly url: string;
};

export const loadToolImage = async ({
  workspaceId,
  projectId,
  provider,
  email,
  siteUrl,
  url,
}: ToolImageParams): Promise<string> => {
  return invokeCommand<string>('load_tool_image', {
    args: {
      workspaceId,
      projectId: projectId ?? null,
      provider,
      email: email ?? null,
      siteUrl: siteUrl ?? null,
      url,
    },
  });
};

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

export type ToolVideo = {
  readonly blob: Blob;
  readonly bytes: number;
};

export const loadToolVideo = async ({
  workspaceId,
  projectId,
  provider,
  email,
  siteUrl,
  url,
}: ToolImageParams): Promise<ToolVideo> => {
  const body = await invokeCommand<ArrayBuffer>('fetch_remote_media', {
    args: {
      workspaceId,
      projectId: projectId ?? null,
      provider,
      email: email ?? null,
      siteUrl: siteUrl ?? null,
      url,
    },
  });
  const view = new Uint8Array(body);
  const type = VIDEO_TYPES[view[0] ?? -1];
  if (type === undefined || view.length < 2) {
    throw new Error('the host answered with something that is not a video');
  }
  const blob = new Blob([view.subarray(1)], { type });
  return { blob, bytes: blob.size };
};

export type ToolMediaKind = 'image' | 'video' | 'other';

export const probeToolMedia = async ({
  workspaceId,
  projectId,
  provider,
  email,
  siteUrl,
  url,
}: ToolImageParams): Promise<ToolMediaKind> => {
  const kind = await invokeCommand<string>('probe_tool_media', {
    args: {
      workspaceId,
      projectId: projectId ?? null,
      provider,
      email: email ?? null,
      siteUrl: siteUrl ?? null,
      url,
    },
  });
  return kind === 'image' || kind === 'video' ? kind : 'other';
};
