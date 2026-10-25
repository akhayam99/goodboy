import { useCallback, useEffect, useRef } from 'react';

type IsStale = () => boolean;

export const useLatestFetch = (): (() => IsStale) => {
  const generation = useRef(0);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  return useCallback(() => {
    generation.current += 1;
    const current = generation.current;
    return () => generation.current !== current;
  }, []);
};
