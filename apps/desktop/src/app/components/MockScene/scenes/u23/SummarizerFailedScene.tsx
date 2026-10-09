import { useEffect, useState } from 'react';
import type { Notification } from '@goodboy/db';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { seedBoardScene, WORKSPACE_ID } from '../BoardScene';
import { AppFrame } from '../audit/AppFrame';
import { seedFrameChromeStubs } from '../audit/frameSeed';
import { useSceneClicks } from '../audit/useSceneClicks';

const STUDIO_CLICKS: ReadonlyArray<string> = ['Open all'];

const SESSION_ID = 'mock-summarizer-failed-session-refunds' as SessionId;
const NOW_MS = Date.parse('2026-09-07T13:15:00.000Z');

type FailureParams = {
  readonly id: string;
  readonly minutesAgo: number;
  readonly body: string;
  readonly coalesceKey: string;
};

const summarizerFailure = ({ id, minutesAgo, body, coalesceKey }: FailureParams): Notification => ({
  id,
  ts: new Date(NOW_MS - minutesAgo * 60_000).toISOString() as IsoDateTime,
  kind: 'error',
  title: 'Summarizer failed',
  body,
  severity: 'error',
  sessionId: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  read: false,
  action: { kind: 'retry-summarizer', sessionId: SESSION_ID },
  coalesceKey,
});

const NOTIFICATIONS: ReadonlyArray<Notification> = [
  summarizerFailure({
    id: 'mock-summarizer-failed-limit',
    minutesAgo: 4,
    body: 'Cursor reached the usage limit for this account.',
    coalesceKey: 'summarizer-failed:cursor:usage_limit',
  }),
  summarizerFailure({
    id: 'mock-summarizer-failed-other',
    minutesAgo: 31,
    body: 'Claude stopped before it could summarize this session. Retry, or pick another summarizer model in Providers.',
    coalesceKey: 'summarizer-failed:anthropic:other',
  }),
];

const seedSummarizerFailures = (): void => {
  useAppStore.setState({
    notifications: NOTIFICATIONS,
    notificationCounts: NOTIFICATIONS.map((notification) => ({
      severity: notification.severity,
      kind: notification.kind,
      hasSession: true,
      hasAction: true,
      read: false,
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

export const SummarizerFailedScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedBoardScene();
    seedFrameChromeStubs();
    seedSummarizerFailures();
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
