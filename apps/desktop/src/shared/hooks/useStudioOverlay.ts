import { useCallback, useEffect, useRef, useState } from 'react';

const EXIT_MS = 200;

type Params = {
  readonly onClose: () => void;
  readonly isEscapeEnabled?: boolean;
};

type StudioOverlay = {
  readonly closing: boolean;
  readonly requestClose: () => void;
};

export const useStudioOverlay = ({ onClose, isEscapeEnabled = true }: Params): StudioOverlay => {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isEscapeEnabledRef = useRef(isEscapeEnabled);
  isEscapeEnabledRef.current = isEscapeEnabled;

  const requestClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEscapeEnabledRef.current) {
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
