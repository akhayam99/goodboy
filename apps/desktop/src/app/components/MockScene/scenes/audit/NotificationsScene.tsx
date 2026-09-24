import { useEffect, useState } from 'react';
import { seedBoardScene } from '../BoardScene';
import { AppFrame } from './AppFrame';
import { seedFrameChromeStubs } from './frameSeed';
import { seedNotifications } from './notificationsSeed';
import { sceneParam } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';

const IS_POPOVER_ONLY = sceneParam({ key: 'view' }) === 'center';
const STUDIO_CLICKS: ReadonlyArray<string> = IS_POPOVER_ONLY ? [] : ['Open all'];

export const NotificationsScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedBoardScene();
    seedFrameChromeStubs();
    seedNotifications();
    setIsReady(true);
  }, []);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(
      () => window.dispatchEvent(new CustomEvent('goodboy:open-notifications')),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [isReady]);
  useSceneClicks({
    isReady,
    labels: STUDIO_CLICKS,
    selector: 'button',
    match: 'prefix',
    intervalMs: 400,
  });
  if (!isReady) {
    return null;
  }
  return <AppFrame view="board" isRailCollapsed={false} />;
};
