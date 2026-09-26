import { useMemo, type ReactNode } from 'react';
import { RemoteImageLoaderProvider } from '@goodboy/ui';
import { integrationLabel } from '../../../features/integrations/components/IntegrationGlyph';
import { useToolImageLoader } from '../../hooks/useToolImageLoader';
import { openUrl } from '../../lib/editor';
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
  const tool = useMemo(
    () => ({ label: integrationLabel({ provider }), open: (url: string) => void openUrl(url) }),
    [provider],
  );

  return (
    <RemoteImageLoaderProvider load={load} shouldAutoLoad={shouldAutoLoad} tool={tool}>
      {children}
    </RemoteImageLoaderProvider>
  );
};
