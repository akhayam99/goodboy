import { useEffect, useState } from 'react';
import type { Notification } from '@goodboy/db';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { NotificationToastBridge } from '../../../../../../features/notifications/components/NotificationToastBridge';
import { registerActionRetry } from '../../../../../../store/slices/notifications/actionRetries';
import { publishTransientNotice } from '../../../../../../store/slices/notifications/transientNotices';
import { useAppStore } from '../../../../../../store';

const AHEAD_MS = 60_000;

type RowParams = {
  readonly id: string;
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly severity: 'error' | 'warning' | 'success';
  readonly retryId?: string;
};

const rowOf = ({ id, key, title, body, severity, retryId }: RowParams): Notification => ({
  id,
  ts: brandId<IsoDateTime>({ value: new Date(Date.now() + AHEAD_MS).toISOString() }),
  kind: severity === 'success' ? 'pr-created' : 'error',
  title,
  body,
  severity,
  sessionId: null,
  workspaceId: null,
  read: severity === 'success',
  action: retryId === undefined ? null : { kind: 'retry-action', retryId },
  coalesceKey: key,
  actedAt: null,
});

export const AttnNoiseScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    setIsReady(true);
  }, []);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const retryId = registerActionRetry({ retry: async () => true });
    useAppStore.setState({
      notifications: [
        rowOf({
          id: 'attn-noise-1',
          key: 'push-failed:harborline-ledger-core',
          title: 'Push to payments-api failed',
          body: 'The remote rejected the push.',
          severity: 'error',
          retryId,
        }),
        rowOf({
          id: 'attn-noise-2',
          key: 'budget:northwind',
          title: 'Session reached 80% of its limit',
          body: 'Nightly reconciliation in Northwind.',
          severity: 'warning',
        }),
      ],
    });
    publishTransientNotice({
      notification: rowOf({
        id: 'attn-noise-3',
        key: 'pr-created:acme-notify-relay',
        title: 'Pull request opened',
        body: 'notify-relay, no bell row.',
        severity: 'success',
      }),
    });
  }, [isReady]);
  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <main className="flex h-screen flex-col bg-background text-foreground">
        <div className="flex-1" />
        <NotificationToastBridge />
      </main>
    </ToastProvider>
  );
};
