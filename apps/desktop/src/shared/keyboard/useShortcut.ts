import { useEffect, useRef } from 'react';
import { registerShortcut } from './dispatcher';
import type { ShortcutId } from './registry';

export const useShortcut = (id: ShortcutId, handler: () => void, enabled = true): void => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return registerShortcut(id, () => handlerRef.current());
  }, [id, enabled]);
};
