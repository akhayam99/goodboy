import type { ReactNode } from 'react';
import {
  RemoteImageAutoLoadContext,
  RemoteImageLoaderContext,
  type RemoteImageAutoLoad,
  type RemoteImageLoader,
} from './loaderContext';

type Props = {
  readonly load: RemoteImageLoader;
  readonly shouldAutoLoad?: RemoteImageAutoLoad;
  readonly children: ReactNode;
};

export const RemoteImageLoaderProvider = ({ load, shouldAutoLoad, children }: Props) => {
  return (
    <RemoteImageLoaderContext.Provider value={load}>
      <RemoteImageAutoLoadContext.Provider value={shouldAutoLoad ?? null}>
        {children}
      </RemoteImageAutoLoadContext.Provider>
    </RemoteImageLoaderContext.Provider>
  );
};
