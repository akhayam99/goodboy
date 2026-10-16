import { useEffect, useRef } from 'react';
import { registerShortcut, type RegistrationOptions } from './dispatcher';
import type { ShortcutId } from './registry';

type Handler = (event: KeyboardEvent) => void | boolean;

export const useShortcut = (
  id: ShortcutId,
  handler: Handler,
  enabled = true,
  options: RegistrationOptions = {},
): void => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const { canDecline } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return registerShortcut(id, (event) => handlerRef.current(event), {
      ...(canDecline === undefined ? {} : { canDecline }),
    });
  }, [id, enabled, canDecline]);
};
