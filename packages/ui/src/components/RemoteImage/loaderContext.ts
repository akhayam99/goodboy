import { createContext } from 'react';

export type RemoteImageLoader = (params: { readonly url: string }) => Promise<string>;
export type RemoteImageAutoLoad = (url: string) => boolean;
export type RemoteImageTool = { readonly label: string; readonly open: (url: string) => void };

export const RemoteImageLoaderContext = createContext<RemoteImageLoader | null>(null);
export const RemoteImageAvatarLoaderContext = createContext<RemoteImageLoader | null>(null);
export const RemoteImageAutoLoadContext = createContext<RemoteImageAutoLoad | null>(null);
export const RemoteImageToolContext = createContext<RemoteImageTool | null>(null);

export type RemoteMediaKind = 'image' | 'video' | 'other';
type ProbeParams = {
  readonly url: string;
};

export type RemoteMediaProbe = (params: ProbeParams) => Promise<RemoteMediaKind>;
export type RemoteMediaOpen = (url: string) => void;

export const RemoteMediaProbeContext = createContext<RemoteMediaProbe | null>(null);
export const RemoteMediaOpenContext = createContext<RemoteMediaOpen | null>(null);

export type RemoteVideoFile = { readonly blob: Blob; readonly bytes: number };
export type RemoteVideoLoader = (params: ProbeParams) => Promise<RemoteVideoFile>;

export const RemoteVideoLoaderContext = createContext<RemoteVideoLoader | null>(null);
