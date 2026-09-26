import type { ReactNode } from 'react';
import { RemoteImageLoaderProvider } from '@goodboy/ui';
import { useToolImageLoader } from '../../hooks/useToolImageLoader';
import type { ToolImageProvider } from '../../lib/remoteImage';

type Props = {
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly provider: ToolImageProvider;
  readonly email?: string | null;
  readonly siteUrl?: string | null;
  readonly children: ReactNode;
};

export const ToolImageScope = ({
  workspaceId,
  projectId,
  provider,
  email,
  siteUrl,
  children,
}: Props) => {
  const { load, shouldAutoLoad } = useToolImageLoader({
    workspaceId,
    projectId,
    provider,
    email,
    siteUrl,
  });

  return (
    <RemoteImageLoaderProvider load={load} shouldAutoLoad={shouldAutoLoad}>
      {children}
    </RemoteImageLoaderProvider>
  );
};
