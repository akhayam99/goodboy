import { useContext, type ReactNode } from 'react';
import {
  RemoteImageAutoLoadContext,
  RemoteImageAvatarLoaderContext,
  RemoteImageLoaderContext,
  RemoteImageToolContext,
  RemoteMediaOpenContext,
  RemoteMediaProbeContext,
  type RemoteImageAutoLoad,
  type RemoteImageLoader,
  type RemoteImageTool,
  type RemoteMediaOpen,
  type RemoteMediaProbe,
} from './loaderContext';

type Props = {
  readonly load: RemoteImageLoader;
  readonly loadAvatar?: RemoteImageLoader;
  readonly shouldAutoLoad?: RemoteImageAutoLoad;
  readonly tool?: RemoteImageTool;
  readonly probe?: RemoteMediaProbe;
  readonly onOpen?: RemoteMediaOpen;
  readonly children: ReactNode;
};

export const RemoteImageLoaderProvider = ({
  load,
  loadAvatar,
  shouldAutoLoad,
  tool,
  probe,
  onOpen,
  children,
}: Props) => {
  const inheritedAvatarLoad = useContext(RemoteImageAvatarLoaderContext);
  const inheritedOpen = useContext(RemoteMediaOpenContext);
  return (
    <RemoteImageLoaderContext.Provider value={load}>
      <RemoteImageAvatarLoaderContext.Provider value={loadAvatar ?? inheritedAvatarLoad}>
        <RemoteImageAutoLoadContext.Provider value={shouldAutoLoad ?? null}>
          <RemoteImageToolContext.Provider value={tool ?? null}>
            <RemoteMediaProbeContext.Provider value={probe ?? null}>
              <RemoteMediaOpenContext.Provider value={onOpen ?? tool?.open ?? inheritedOpen}>
                {children}
              </RemoteMediaOpenContext.Provider>
            </RemoteMediaProbeContext.Provider>
          </RemoteImageToolContext.Provider>
        </RemoteImageAutoLoadContext.Provider>
      </RemoteImageAvatarLoaderContext.Provider>
    </RemoteImageLoaderContext.Provider>
  );
};
