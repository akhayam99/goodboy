import { useCallback, useRef, type Ref } from 'react';
import { assignRef } from '../assignRef';

type Params = {
  readonly drawerRef: Ref<HTMLElement> | undefined;
};

export const useAsideRef = ({ drawerRef }: Params) => {
  const asideRef = useRef<HTMLElement | null>(null);
  const setAside = useCallback(
    (node: HTMLElement | null) => {
      asideRef.current = node;
      assignRef({ ref: drawerRef, value: node });
    },
    [drawerRef],
  );
  return { asideRef, setAside };
};
