import { useEffect, useRef, type RefObject } from 'react';
import { holdPaletteScope } from '../heldPaletteScope';
import type { CommitScope } from '../types';

type Params = {
  readonly scope: CommitScope | null;
};

export const useHeldPaletteScope = <T extends HTMLElement>({
  scope,
}: Params): RefObject<T | null> => {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (element === null || scope === null) {
      return undefined;
    }
    return holdPaletteScope({ element, scope });
  }, [scope]);
  return ref;
};
