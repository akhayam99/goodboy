import { useContext, useEffect, useRef } from 'react';
import { DrawerParkedContext } from './drawerParkedContext';
import { registerEscapeLayer } from './escape';

export const useEscapeLayer = (onEscape: () => void, active = true, isBase = false): void => {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;
  const isParked = useContext(DrawerParkedContext);
  const isParkedRef = useRef(isParked);
  isParkedRef.current = isParked;

  useEffect(() => {
    if (!active) {
      return;
    }
    return registerEscapeLayer(
      () => handlerRef.current(),
      isBase,
      () => isParkedRef.current,
    );
  }, [active, isBase]);
};
