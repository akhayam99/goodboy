import { useCallback, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';

type Params = {
  readonly hasActiveSession: boolean;
};

const readPreference = (): boolean => {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  try {
    return localStorage.getItem(STORAGE_KEYS.sessionSidebarCollapsed) === '1';
  } catch {
    return false;
  }
};

type WriteParams = {
  readonly next: boolean;
};

const writePreference = ({ next }: WriteParams): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.sessionSidebarCollapsed, next ? '1' : '0');
  } catch {
    return;
  }
};

export const useSessionSidebarVisibility = ({ hasActiveSession }: Params) => {
  const [isCollapsed, setIsCollapsed] = useState(readPreference);
  const leftHidden = useMemo(
    () => !hasActiveSession || isCollapsed,
    [hasActiveSession, isCollapsed],
  );

  const toggle = useCallback(() => {
    if (!hasActiveSession) {
      return;
    }
    setIsCollapsed((current) => {
      const next = !current;
      writePreference({ next });
      return next;
    });
  }, [hasActiveSession]);

  return {
    isCollapsed,
    leftHidden,
    toggle,
  };
};
