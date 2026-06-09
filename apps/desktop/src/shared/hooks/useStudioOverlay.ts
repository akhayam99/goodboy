import { useCallback, useEffect, useState } from 'react';

const EXIT_MS = 200;

type StudioOverlay = {
  readonly closing: boolean;
  readonly requestClose: () => void;
};

export function useStudioOverlay(onClose: () => void): StudioOverlay {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(onClose, EXIT_MS);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  return { closing, requestClose };
}
