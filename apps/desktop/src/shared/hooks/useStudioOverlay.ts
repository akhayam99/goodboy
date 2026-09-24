import { useCallback, useEffect, useRef, useState } from 'react';

const EXIT_MS = 200;

type Params = {
  readonly onClose: () => void;
};

type StudioOverlay = {
  readonly closing: boolean;
  readonly requestClose: () => void;
};

export const useStudioOverlay = ({ onClose }: Params): StudioOverlay => {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  useEffect(() => {
    if (!closing) {
      return;
    }
    const t = setTimeout(() => onCloseRef.current(), EXIT_MS);
    return () => clearTimeout(t);
  }, [closing]);

  return { closing, requestClose };
};
