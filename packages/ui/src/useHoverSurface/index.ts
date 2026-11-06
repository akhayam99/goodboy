import { useLayoutEffect } from 'react';
import { hoverSurfaces } from '../hoverSurfaceStore';

type Params = { readonly isActive: boolean };

export const useHoverSurface = ({ isActive }: Params): void => {
  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }
    return hoverSurfaces.register();
  }, [isActive]);
};
