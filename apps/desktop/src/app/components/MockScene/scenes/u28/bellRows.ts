import type { Notification, NotificationAction } from '@goodboy/db';
import { brandId, type IsoDateTime, type SessionId } from '@goodboy/types';
import { WORKSPACE_ID } from '../BoardScene';

export const BELL_SESSION_ID = brandId<SessionId>({
  value: 'mock-bell-overflow-session-payout-export',
});

type BellRowParams = {
  readonly index: number;
  readonly title: string;
  readonly body: string | null;
  readonly kind: Notification['kind'];
  readonly severity: Notification['severity'];
  readonly action?: NotificationAction;
  readonly isActed?: boolean;
};

export const rowOf = ({
  index,
  title,
  body,
  kind,
  severity,
  action,
  isActed = false,
}: BellRowParams): Notification => ({
  id: `mock-bell-overflow-${index}`,
  ts: brandId<IsoDateTime>({
    value: new Date(Date.now() - (index + 1) * 11 * 60_000).toISOString(),
  }),
  sessionId: BELL_SESSION_ID,
  workspaceId: WORKSPACE_ID,
  read: isActed,
  action: action ?? null,
  coalesceKey: `mock-bell-overflow-${index}`,
  actedAt: isActed
    ? brandId<IsoDateTime>({ value: new Date(Date.now() - index * 60_000).toISOString() })
    : null,
  kind,
  title,
  body,
  severity,
});

export const RETRY: NotificationAction = { kind: 'retry-summarizer', sessionId: BELL_SESSION_ID };
export const OPEN: NotificationAction = { kind: 'open-activity', sessionId: BELL_SESSION_ID };
