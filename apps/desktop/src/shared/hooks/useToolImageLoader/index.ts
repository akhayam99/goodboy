import { useMemo } from 'react';
import type { RemoteImageAutoLoad, RemoteImageLoader } from '@goodboy/ui';
import { loadRemoteImage, loadToolImage, type ToolImageProvider } from '../../lib/remoteImage';

const TOOL_HOSTS: Readonly<Record<ToolImageProvider, (url: URL) => boolean>> = {
  linear: (url) => url.hostname === 'uploads.linear.app',
  jira: (url) =>
    url.hostname.endsWith('.atlassian.net') &&
    url.pathname.startsWith('/rest/api/3/attachment/content/'),
  github: (url) =>
    url.hostname === 'github.com' && url.pathname.startsWith('/user-attachments/assets/'),
};

type HostCheckParams = {
  readonly provider: ToolImageProvider;
  readonly url: string;
};

const isToolHost = ({ provider, url }: HostCheckParams): boolean => {
  try {
    return TOOL_HOSTS[provider](new URL(url));
  } catch {
    return false;
  }
};

export type ToolImageLoader = {
  readonly load: RemoteImageLoader;
  readonly shouldAutoLoad: RemoteImageAutoLoad;
};

type Params = {
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly provider: ToolImageProvider;
  readonly email?: string | null;
};

export const useToolImageLoader = ({
  workspaceId,
  projectId,
  provider,
  email,
}: Params): ToolImageLoader => {
  return useMemo(
    () => ({
      load: ({ url }: { readonly url: string }) =>
        isToolHost({ provider, url })
          ? loadToolImage({ workspaceId, projectId, provider, email, url })
          : loadRemoteImage({ url }),
      shouldAutoLoad: (url: string) => isToolHost({ provider, url }),
    }),
    [workspaceId, projectId, provider, email],
  );
};
