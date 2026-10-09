import { useEffect } from 'react';
import type { Notification } from '@goodboy/db';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { ShellScene } from '../../ShellScene';
import { WORKSPACE_ID } from '../../BoardScene';

const SESSION_ID = 'mock-controls-session-ledger-export' as SessionId;

const unreadNotification = ({
  id,
  title,
}: {
  readonly id: string;
  readonly title: string;
}): Notification => ({
  id,
  ts: new Date().toISOString() as IsoDateTime,
  sessionId: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  read: false,
  action: null,
  coalesceKey: null,
  kind: 'pr-created',
  title,
  body: 'payments-api #318',
  severity: 'success',
});

export const ControlsTopbarScene = () => {
  useEffect(() => {
    useAppStore.setState({
      notifications: [
        unreadNotification({ id: 'mock-controls-notification-1', title: 'Pull request opened' }),
        unreadNotification({ id: 'mock-controls-notification-2', title: 'Checks passed' }),
        unreadNotification({ id: 'mock-controls-notification-3', title: 'Review requested' }),
      ],
    });
  }, []);
  return <ShellScene />;
};
