import { useContext, useLayoutEffect } from 'react';
import { DrawerContentContext } from '../drawerContentContext';

type Params = { readonly width: number };

export const useDrawerContentInset = ({ width }: Params): void => {
  const context = useContext(DrawerContentContext);
  const setInset = context?.setInset;
  useLayoutEffect(() => {
    setInset?.(width);
    return () => setInset?.(0);
  }, [setInset, width]);
};
