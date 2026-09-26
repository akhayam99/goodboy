import { useMemo } from 'react';
import type { RemoteImageAutoLoad, RemoteImageLoader } from '@goodboy/ui';
import { loadRemoteImage, loadToolImage, type ToolImageProvider } from '../../lib/remoteImage';

const TOOL_HOSTS: Readonly<
  Record<ToolImageProvider, (url: URL, siteUrl: string | null) => boolean>
> = {
  linear: (url) => url.hostname === 'uploads.linear.app',
  jira: (url, siteUrl) => {
    if (siteUrl == null) {
      return false;
    }
    try {
      return (
        url.hostname === new URL(siteUrl).hostname &&
        url.pathname.startsWith('/rest/api/3/attachment/content/')
      );
    } catch {
      return false;
    }
  },
  github: (url) =>
    url.hostname === 'github.com' && url.pathname.startsWith('/user-attachments/assets/'),
};

type HostCheckParams = {
  readonly provider: ToolImageProvider;
  readonly url: string;
  readonly siteUrl: string | null;
};

const isToolHost = ({ provider, url, siteUrl }: HostCheckParams): boolean => {
  try {
    return TOOL_HOSTS[provider](new URL(url), siteUrl);
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
  readonly siteUrl?: string | null;
};

export const useToolImageLoader = ({
  workspaceId,
  projectId,
  provider,
  email,
  siteUrl,
}: Params): ToolImageLoader => {
  const site = siteUrl ?? null;
  return useMemo(
    () => ({
      load: ({ url }: { readonly url: string }) =>
        isToolHost({ provider, url, siteUrl: site })
          ? loadToolImage({ workspaceId, projectId, provider, email, siteUrl: site, url })
          : loadRemoteImage({ url }),
      shouldAutoLoad: (url: string) => isToolHost({ provider, url, siteUrl: site }),
    }),
    [workspaceId, projectId, provider, email, site],
  );
};
