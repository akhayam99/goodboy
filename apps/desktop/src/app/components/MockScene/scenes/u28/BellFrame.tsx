import { useEffect, useState } from 'react';
import type { Notification } from '@goodboy/db';
import { dispatchWindowEvent } from '../../../../../shared/lib/dispatchWindowEvent';
import { useAppStore } from '../../../../../store';
import { seedBoardScene } from '../BoardScene';
import { AppFrame } from '../audit/AppFrame';
import { seedFrameChromeStubs } from '../audit/frameSeed';
import { useSceneClicks } from '../audit/useSceneClicks';

const NO_CLICKS: ReadonlyArray<string> = [];

type Props = {
  readonly notifications: ReadonlyArray<Notification>;
  readonly clicks?: ReadonlyArray<string>;
};

type SeedParams = Pick<Props, 'notifications'>;

const seedBell = ({ notifications }: SeedParams): void => {
  useAppStore.setState({
    notifications,
    notificationCounts: notifications.map((notification) => ({
      severity: notification.severity,
      kind: notification.kind,
      hasSession: true,
      hasAction: notification.action !== null,
      actionKind: notification.action?.kind ?? null,
      isActed: notification.actedAt !== null,
      read: notification.read,
      inWorkspace: true,
      count: 1,
    })),
    hasOlderNotifications: false,
    notificationsLoading: false,
    loadNotifications: async () => undefined,
    markNotificationsRead: async () => undefined,
    markNotificationRead: async () => undefined,
  });
};

export const BellFrame = ({ notifications, clicks = NO_CLICKS }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedBoardScene();
    seedFrameChromeStubs();
    seedBell({ notifications });
    setIsReady(true);
  }, [notifications]);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(
      () => dispatchWindowEvent({ name: 'goodboy:open-notifications' }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [isReady]);
  useSceneClicks({
    isReady,
    labels: clicks,
    selector: '[role="tab"]',
    match: 'prefix',
    intervalMs: 500,
  });
  if (!isReady) {
    return null;
  }
  return <AppFrame view="board" isRailCollapsed={false} />;
};
