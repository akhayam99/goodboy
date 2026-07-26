import { useCallback, useState } from 'react';

type SetWidth = (width: number) => void;

export const useColumnWidth = (key: string, defaultWidth: number): readonly [number, SetWidth] => {
  const [width, setWidthState] = useState(() => {
    if (typeof localStorage === 'undefined') {
      return defaultWidth;
    }
    const storedWidth = Number.parseInt(localStorage.getItem(key) ?? '', 10);
    return Number.isNaN(storedWidth) ? defaultWidth : storedWidth;
  });
  const setWidth = useCallback(
    (nextWidth: number) => {
      setWidthState(nextWidth);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, String(nextWidth));
      }
    },
    [key],
  );
  return [width, setWidth] as const;
};
