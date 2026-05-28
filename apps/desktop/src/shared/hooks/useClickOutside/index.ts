import { useEffect } from 'react';

/**
 * Fires `onClose` when a `mousedown` lands outside `ref`. Used to dismiss
 * popovers, dropdowns, and lightweight menus that aren't backed by a
 * full modal overlay.
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}
