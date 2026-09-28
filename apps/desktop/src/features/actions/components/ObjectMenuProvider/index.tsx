import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNativeMenuPolicy } from '../../../../app/hooks/useNativeMenuPolicy';
import { ObjectContextMenu } from './ObjectContextMenu';
import {
  ObjectMenuContext,
  type ObjectMenuContextValue,
  type ObjectMenuRequest,
} from './objectMenuContext';

const OPEN_ATTRIBUTE = 'data-menu-open';

type Props = {
  readonly children: ReactNode;
};

export const ObjectMenuProvider = ({ children }: Props) => {
  const [request, setRequest] = useState<ObjectMenuRequest | null>(null);
  const [generation, setGeneration] = useState(0);
  const openerRef = useRef<HTMLElement | null>(null);

  const release = useCallback(({ shouldRefocus }: { readonly shouldRefocus: boolean }) => {
    const opener = openerRef.current;
    openerRef.current = null;
    opener?.removeAttribute(OPEN_ATTRIBUTE);
    if (shouldRefocus && opener !== null && opener.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }, []);

  const open = useCallback(
    (next: ObjectMenuRequest) => {
      release({ shouldRefocus: false });
      openerRef.current = next.opener;
      next.opener?.setAttribute(OPEN_ATTRIBUTE, 'true');
      setGeneration((value) => value + 1);
      setRequest(next);
    },
    [release],
  );

  const close = useCallback(() => {
    const active = document.activeElement;
    const isFocusInMenu =
      active instanceof Element && active.closest('[data-menu-portal]') !== null;
    release({ shouldRefocus: isFocusInMenu || active === document.body });
    setRequest(null);
  }, [release]);

  useNativeMenuPolicy({
    onLink: ({ href, point, opener }) =>
      open({ target: { kind: 'link', href }, point, anchorKey: null, opener }),
  });

  const value = useMemo<ObjectMenuContextValue>(() => ({ open }), [open]);

  return (
    <ObjectMenuContext.Provider value={value}>
      {children}
      {request === null ? null : (
        <ObjectContextMenu key={generation} request={request} onClose={close} />
      )}
    </ObjectMenuContext.Provider>
  );
};
