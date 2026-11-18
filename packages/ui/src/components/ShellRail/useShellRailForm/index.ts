import { useCallback, useSyncExternalStore } from 'react';
import type { ShellRailForm } from '../shellRailFormContext';
import { SHELL_RAIL_NARROW_BELOW_PX } from '../shellRailGeometry';

const NARROW_QUERY = `(max-width: ${SHELL_RAIL_NARROW_BELOW_PX - 0.02}px)`;

const narrowQuery = (): MediaQueryList | null =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? null
    : window.matchMedia(NARROW_QUERY);

const formNow = (): ShellRailForm => (narrowQuery()?.matches === true ? 'narrow' : 'wide');

const wideForm = (): ShellRailForm => 'wide';

export const useShellRailForm = (): ShellRailForm => {
  const subscribe = useCallback((onChange: () => void) => {
    const query = narrowQuery();
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
  }, []);
  return useSyncExternalStore(subscribe, formNow, wideForm);
};
