import { useEffect, useState } from 'react';
import type { Notification } from '@goodboy/db';
import type { AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { seedBoardScene, WORKSPACE_ID } from '../BoardScene';
import { AppFrame } from '../audit/AppFrame';
import { seedFrameChromeStubs } from '../audit/frameSeed';
import { useSceneClicks } from '../audit/useSceneClicks';
import { sceneClock } from '../../sceneClock';

const STUDIO_CLICKS: ReadonlyArray<string> = ['Open all'];

const SESSION_ID = 'mock-summarizer-failed-session-refunds' as SessionId;
const NOW_MS = sceneClock({ anchor: '2026-09-07T13:15:00.000Z' }).ms({
  at: '2026-09-07T13:15:00.000Z',
});

const RUN_ID = 'mock-run-refunds-1' as WorkflowRunId;
const AGENT_ID = 'mock-agent-refunds-implement' as AgentId;

type NoticeParams = {
  readonly id: string;
  readonly minutesAgo: number;
  readonly kind: Notification['kind'];
  readonly title: string;
  readonly body: string;
  readonly severity: Notification['severity'];
  readonly action: Notification['action'];
  readonly coalesceKey: string;
};

const notice = ({
  id,
  minutesAgo,
  kind,
  title,
  body,
  severity,
  action,
  coalesceKey,
}: NoticeParams): Notification => ({
  id,
  ts: new Date(NOW_MS - minutesAgo * 60_000).toISOString() as IsoDateTime,
  kind,
  title,
  body,
  severity,
  sessionId: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  read: false,
  action,
  coalesceKey,
});

const NOTIFICATIONS: ReadonlyArray<Notification> = [
  notice({
    id: 'mock-summarizer-failed',
    minutesAgo: 4,
    kind: 'error',
    title: 'Summarizer failed',
    body: 'Cursor reached the usage limit for this account.',
    severity: 'error',
    action: { kind: 'retry-summarizer', sessionId: SESSION_ID },
    coalesceKey: `summarizer-failed:${SESSION_ID}`,
  }),
  notice({
    id: 'mock-step-summary-unavailable',
    minutesAgo: 9,
    kind: 'summarizer-degraded',
    title: 'Step summary unavailable',
    body: 'Every summarizer model failed (Cursor, Claude, Codex), so the output of Implement refunds was carried over unsummarized. Retry once a provider is back.',
    severity: 'warning',
    action: { kind: 'retry-step-summary', sessionId: SESSION_ID, agentId: AGENT_ID },
    coalesceKey: `step-summary-degraded:${SESSION_ID}`,
  }),
  notice({
    id: 'mock-orchestrator-unreadable',
    minutesAgo: 14,
    kind: 'error',
    title: "Couldn't read the orchestrator's reply",
    body: 'Claude, Codex replied with something that is not a decision. Retry to ask again.',
    severity: 'warning',
    action: { kind: 'retry-orchestrator', sessionId: SESSION_ID, workflowRunId: RUN_ID },
    coalesceKey: `orchestrator-unreadable:${RUN_ID}`,
  }),
  notice({
    id: 'mock-orchestrator-blocked',
    minutesAgo: 22,
    kind: 'error',
    title: 'Orchestrated run blocked',
    body: 'The refunds export needs a decision: keep the Northwind schema or move to the Harborline one.',
    severity: 'warning',
    action: { kind: 'open-agent', sessionId: SESSION_ID, agentId: AGENT_ID },
    coalesceKey: `orchestrator-blocked:${RUN_ID}`,
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
    summarizerStatus: {
      [SESSION_ID]: {
        status: 'error',
        lastUpdate: new Date(NOW_MS - 4 * 60_000).toISOString() as IsoDateTime,
        error: 'Cursor reached the usage limit for this account.',
        lastUsage: null,
        lastAttempt: {
          turnInput: 'Export the refunds as a ledger report.',
          turnOutput: 'The refunds export is written.',
          workingDir: null,
        },
      },
    },
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
