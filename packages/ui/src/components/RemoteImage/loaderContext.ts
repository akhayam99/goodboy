import { createContext } from 'react';

export type RemoteImageLoader = (params: { readonly url: string }) => Promise<string>;
export type RemoteImageAutoLoad = (url: string) => boolean;
export type RemoteImageTool = { readonly label: string; readonly open: (url: string) => void };

export const RemoteImageLoaderContext = createContext<RemoteImageLoader | null>(null);
export const RemoteImageAutoLoadContext = createContext<RemoteImageAutoLoad | null>(null);
export const RemoteImageToolContext = createContext<RemoteImageTool | null>(null);
