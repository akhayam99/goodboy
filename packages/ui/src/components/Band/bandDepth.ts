import { createContext, useContext } from 'react';

export const BandDepthContext = createContext(false);

const isDevBuild = (): boolean =>
  (import.meta as ImportMeta & { readonly env?: { readonly DEV?: boolean } }).env?.DEV === true;

export const useBandDepthGuard = (): void => {
  const isInsideBand = useContext(BandDepthContext);
  if (isInsideBand && isDevBuild()) {
    throw new Error('A band never sits inside another band. Use rows inside one band instead.');
  }
};
