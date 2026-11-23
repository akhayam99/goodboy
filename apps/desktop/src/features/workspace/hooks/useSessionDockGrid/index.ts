import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { startDeskTool } from '../../../session/desk/startDeskTool';
import { watchSessionDockGrid } from './watchSessionDockGrid';

export const useSessionDockGrid = (): void => {
  const isHydrated = useAppStore((state) => state.hydrated);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    return watchSessionDockGrid({
      store: useAppStore,
      onEntered: ({ sessionId }) => void startDeskTool({ sessionId, mountId: null }),
    });
  }, [isHydrated]);
};
