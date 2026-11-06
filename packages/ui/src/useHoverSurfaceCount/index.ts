import { useLayoutEffect, useState } from 'react';
import { hoverSurfaces } from '../hoverSurfaceStore';

export const useHoverSurfaceCount = (): number => {
  const [count, setCount] = useState(hoverSurfaces.count());
  useLayoutEffect(() => {
    setCount(hoverSurfaces.count());
    return hoverSurfaces.watch({ onChange: () => setCount(hoverSurfaces.count()) });
  }, []);
  return count;
};
