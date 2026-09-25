import { useEffect } from 'react';
import { useAppStore } from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';

export const useCloseStaleDrawer = (): void => {
  const hasStaleDrawer = useAppStore(
    (s) => (s.drawer ?? null) !== null && selectOpenDrawer(s) === null,
  );
  const closeDrawer = useAppStore((s) => s.closeDrawer);

  useEffect(() => {
    if (hasStaleDrawer) {
      closeDrawer();
    }
  }, [closeDrawer, hasStaleDrawer]);
};
