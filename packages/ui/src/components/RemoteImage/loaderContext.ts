import { createContext } from 'react';

export type RemoteImageLoader = (params: { readonly url: string }) => Promise<string>;

export const RemoteImageLoaderContext = createContext<RemoteImageLoader | null>(null);
