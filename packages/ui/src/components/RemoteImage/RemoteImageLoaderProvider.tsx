import type { ReactNode } from 'react';
import { RemoteImageLoaderContext, type RemoteImageLoader } from './loaderContext';

type Props = {
  readonly load: RemoteImageLoader;
  readonly children: ReactNode;
};

export const RemoteImageLoaderProvider = ({ load, children }: Props) => {
  return (
    <RemoteImageLoaderContext.Provider value={load}>{children}</RemoteImageLoaderContext.Provider>
  );
};
