import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { LevelsScene } from '../u25/c02LevelsScene';

const CONFIG = { isBusy: true, place: 'board' } as const;

export const SidebarPortsScene = () => {
  useEffect(() => {
    useAppStore.setState({
      monitorSnapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
      monitorPinned: [{ port: 5173, description: 'notify-relay dev server' }],
    });
  }, []);

  return <LevelsScene config={CONFIG} />;
};
