import { useCallback, useEffect, useRef, useState } from 'react';
import { useEscapeLayer } from '@goodboy/ui';

export const STUDIO_EXIT_MS = 200;

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

  const requestClose = useCallback(() => setClosing(true), []);

  useEscapeLayer(requestClose, isEscapeEnabled && !closing);

  useEffect(() => {
    if (!closing) {
      return;
    }
    const t = setTimeout(() => onCloseRef.current(), STUDIO_EXIT_MS);
    return () => clearTimeout(t);
  }, [closing]);

  return { closing, requestClose };
};
