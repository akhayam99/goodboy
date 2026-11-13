import { useContext, type ReactNode } from 'react';
import {
  RemoteImageAutoLoadContext,
  RemoteImageAvatarLoaderContext,
  RemoteImageLoaderContext,
  RemoteImageToolContext,
  type RemoteImageAutoLoad,
  type RemoteImageLoader,
  type RemoteImageTool,
} from './loaderContext';

type Props = {
  readonly load: RemoteImageLoader;
  readonly loadAvatar?: RemoteImageLoader;
  readonly shouldAutoLoad?: RemoteImageAutoLoad;
  readonly tool?: RemoteImageTool;
  readonly children: ReactNode;
};

export const RemoteImageLoaderProvider = ({
  load,
  loadAvatar,
  shouldAutoLoad,
  tool,
  children,
}: Props) => {
  const inheritedAvatarLoad = useContext(RemoteImageAvatarLoaderContext);
  return (
    <RemoteImageLoaderContext.Provider value={load}>
      <RemoteImageAvatarLoaderContext.Provider value={loadAvatar ?? inheritedAvatarLoad}>
        <RemoteImageAutoLoadContext.Provider value={shouldAutoLoad ?? null}>
          <RemoteImageToolContext.Provider value={tool ?? null}>
            {children}
          </RemoteImageToolContext.Provider>
        </RemoteImageAutoLoadContext.Provider>
      </RemoteImageAvatarLoaderContext.Provider>
    </RemoteImageLoaderContext.Provider>
  );
};
