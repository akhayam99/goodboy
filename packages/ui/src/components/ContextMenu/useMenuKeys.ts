import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import {
  focusFirstMenuItem,
  isMenuNavigationKey,
  isTypeaheadKey,
  moveMenuFocus,
  typeaheadMenuFocus,
} from './menuKeys';

const TYPEAHEAD_RESET_MS = 500;

type Params = {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly isOpen: boolean;
  readonly isEnabled: boolean;
};

export const useMenuKeys = ({ containerRef, isOpen, isEnabled }: Params) => {
  const typeahead = useRef({ query: '', at: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!isEnabled || !isOpen || container === null) {
      return;
    }
    if (container.contains(document.activeElement)) {
      return;
    }
    focusFirstMenuItem({ container });
  }, [containerRef, isEnabled, isOpen]);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const container = containerRef.current;
      if (!isEnabled || container === null || event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      if (isMenuNavigationKey(event.key)) {
        event.preventDefault();
        moveMenuFocus({ container, key: event.key });
        return;
      }
      if (!isTypeaheadKey(event)) {
        return;
      }
      const now = Date.now();
      const query =
        now - typeahead.current.at > TYPEAHEAD_RESET_MS
          ? event.key
          : `${typeahead.current.query}${event.key}`;
      typeahead.current = { query, at: now };
      if (typeaheadMenuFocus({ container, query })) {
        event.preventDefault();
      }
    },
    [containerRef, isEnabled],
  );
};
