import type { ReactNode } from 'react';
import {
  RemoteImageAutoLoadContext,
  RemoteImageLoaderContext,
  RemoteImageToolContext,
  type RemoteImageAutoLoad,
  type RemoteImageLoader,
  type RemoteImageTool,
} from './loaderContext';

type Props = {
  readonly load: RemoteImageLoader;
  readonly shouldAutoLoad?: RemoteImageAutoLoad;
  readonly tool?: RemoteImageTool;
  readonly children: ReactNode;
};

export const RemoteImageLoaderProvider = ({ load, shouldAutoLoad, tool, children }: Props) => {
  return (
    <RemoteImageLoaderContext.Provider value={load}>
      <RemoteImageAutoLoadContext.Provider value={shouldAutoLoad ?? null}>
        <RemoteImageToolContext.Provider value={tool ?? null}>
          {children}
        </RemoteImageToolContext.Provider>
      </RemoteImageAutoLoadContext.Provider>
    </RemoteImageLoaderContext.Provider>
  );
};
