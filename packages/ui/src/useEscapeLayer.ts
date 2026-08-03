import { useEffect, useRef } from 'react';
import { registerEscapeLayer } from './escape';

export const useEscapeLayer = (onEscape: () => void, active = true): void => {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  useEffect(() => {
    if (!active) {
      return;
    }
    return registerEscapeLayer(() => handlerRef.current());
  }, [active]);
};
