import { useCallback, useEffect, useRef, useState, type FocusEvent, type RefObject } from 'react';
import type { ProviderConnectPhase } from '../../../../store/slices/providers';

type Params = {
  readonly autoOpenPhase: ProviderConnectPhase | null;
};

type ConnectDetailsControl = {
  readonly open: boolean;
  readonly engaged: boolean;
  readonly regionRef: RefObject<HTMLDivElement | null>;
  readonly setOpen: (next: boolean) => void;
  readonly onFocus: () => void;
  readonly onBlur: (event: FocusEvent<HTMLDivElement>) => void;
};

export const useConnectDetails = ({ autoOpenPhase }: Params): ConnectDetailsControl => {
  const [open, setOpenState] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const lastAutoPhase = useRef<ProviderConnectPhase | null>(null);

  useEffect(() => {
    if (autoOpenPhase === null) {
      lastAutoPhase.current = null;
      return;
    }
    if (lastAutoPhase.current === autoOpenPhase) {
      return;
    }
    lastAutoPhase.current = autoOpenPhase;
    setOpenState(true);
  }, [autoOpenPhase]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (next) {
      return;
    }
    setEngaged(false);
  }, []);

  const onFocus = useCallback(() => {
    setEngaged(true);
  }, []);

  const onBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next === null) {
      return;
    }
    if (regionRef.current?.contains(next) === true) {
      return;
    }
    setEngaged(false);
  }, []);

  return { open, engaged, regionRef, setOpen, onFocus, onBlur };
};
