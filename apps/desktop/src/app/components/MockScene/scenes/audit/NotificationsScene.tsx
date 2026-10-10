import { useEffect, useState } from 'react';
import { seedBoardScene } from '../BoardScene';
import { AppFrame } from './AppFrame';
import { seedFrameChromeStubs } from './frameSeed';
import { seedNotifications } from './notificationsSeed';
import { sceneParam, sceneParamList } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';

const IS_POPOVER_ONLY = sceneParam({ key: 'view' }) === 'center';
const DEFAULT_CLICKS: ReadonlyArray<string> = ['Open all'];
const OPEN_LABELS = sceneParamList({ key: 'open', separator: ',' });

type Props = {
  readonly openLabels?: ReadonlyArray<string>;
};

export const NotificationsScene = ({ openLabels }: Props) => {
  const studioClicks = IS_POPOVER_ONLY
    ? []
    : (openLabels ?? (OPEN_LABELS.length > 0 ? OPEN_LABELS : DEFAULT_CLICKS));
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
    labels: studioClicks,
    selector: 'button',
    match: 'prefix',
    intervalMs: 400,
  });
  if (!isReady) {
    return null;
  }
  return <AppFrame view="board" isRailCollapsed={false} />;
};
