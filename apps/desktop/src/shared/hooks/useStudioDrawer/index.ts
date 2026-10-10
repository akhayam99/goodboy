import { useLayoutEffect } from 'react';
import {
  useStudioFrame,
  type StudioDrawerSpec,
} from '../../components/StudioShell/studioFrameContext';

export const useStudioDrawer = (spec: StudioDrawerSpec): boolean => {
  const setDrawer = useStudioFrame()?.setDrawer ?? null;

  useLayoutEffect(() => {
    setDrawer?.(spec);
  });

  useLayoutEffect(() => () => setDrawer?.(null), [setDrawer]);

  return setDrawer !== null;
};
