import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';

type Params = {
  readonly hasActiveSession: boolean;
};

export type PeekSource = 'edge' | 'anchor';

const OPEN_DELAY_MS: Record<PeekSource, number> = {
  edge: 150,
  anchor: 100,
};

const CLOSE_DELAY_MS = 300;

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

type RequestPeekParams = {
  readonly source: PeekSource;
};

export const useSessionSidebarVisibility = ({ hasActiveSession }: Params) => {
  const [isCollapsed, setIsCollapsed] = useState(readPreference);
  const [isPeeking, setIsPeeking] = useState(false);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const holdCount = useRef(0);
  const wantsClose = useRef(false);

  const clearOpenTimer = useCallback(() => {
    if (openTimer.current === null) {
      return;
    }
    window.clearTimeout(openTimer.current);
    openTimer.current = null;
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current === null) {
      return;
    }
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const closePeek = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    wantsClose.current = false;
    holdCount.current = 0;
    setIsPeeking(false);
  }, [clearCloseTimer, clearOpenTimer]);

  const cancelClose = useCallback(() => {
    wantsClose.current = false;
    clearCloseTimer();
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    wantsClose.current = true;
    if (holdCount.current > 0) {
      return;
    }
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      wantsClose.current = false;
      setIsPeeking(false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer]);

  const requestPeek = useCallback(
    ({ source }: RequestPeekParams) => {
      if (!hasActiveSession || !isCollapsed) {
        return;
      }
      cancelClose();
      if (isPeeking || openTimer.current !== null) {
        return;
      }
      openTimer.current = window.setTimeout(() => {
        openTimer.current = null;
        setIsPeeking(true);
      }, OPEN_DELAY_MS[source]);
    },
    [cancelClose, hasActiveSession, isCollapsed, isPeeking],
  );

  const cancelPeek = useCallback(() => {
    clearOpenTimer();
  }, [clearOpenTimer]);

  const holdPeek = useCallback(() => {
    holdCount.current += 1;
    clearCloseTimer();
  }, [clearCloseTimer]);

  const releasePeek = useCallback(() => {
    holdCount.current = Math.max(0, holdCount.current - 1);
    if (holdCount.current > 0 || !wantsClose.current) {
      return;
    }
    scheduleClose();
  }, [scheduleClose]);

  const pin = useCallback(() => {
    closePeek();
    setIsCollapsed(() => {
      writePreference({ next: false });
      return false;
    });
  }, [closePeek]);

  const toggle = useCallback(() => {
    if (!hasActiveSession) {
      return;
    }
    closePeek();
    setIsCollapsed((current) => {
      const next = !current;
      writePreference({ next });
      return next;
    });
  }, [closePeek, hasActiveSession]);

  useEffect(() => {
    if (hasActiveSession && isCollapsed) {
      return;
    }
    closePeek();
  }, [closePeek, hasActiveSession, isCollapsed]);

  useEffect(() => {
    if (!isPeeking) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || holdCount.current > 0) {
        return;
      }
      closePeek();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePeek, isPeeking]);

  useEffect(() => {
    return () => {
      if (openTimer.current !== null) {
        window.clearTimeout(openTimer.current);
      }
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
      }
    };
  }, []);

  return {
    isCollapsed,
    isPeeking,
    toggle,
    pin,
    requestPeek,
    cancelPeek,
    scheduleClose,
    cancelClose,
    closePeek,
    holdPeek,
    releasePeek,
  };
};
