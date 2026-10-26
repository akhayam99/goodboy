// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Notification, NotificationAction } from '@goodboy/db';
import { brandId, type SessionId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { isoDateTimeOf } from '../../../../__tests__/helpers/brandedIds';
import { NotificationToastBridge } from './index';

const SESSION = brandId<SessionId>({ value: 'session-1' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
});

afterEach(cleanup);

type RowParams = {
  readonly id: string;
  readonly action: NotificationAction;
};

const failure = ({ id, action }: RowParams): Notification => ({
  id,
  ts: isoDateTimeOf({ value: new Date(Date.now() + 60_000).toISOString() }),
  kind: 'error',
  title: 'Something failed',
  body: null,
  severity: 'error',
  sessionId: SESSION,
  workspaceId: null,
  read: false,
  action,
  coalesceKey: id,
  actedAt: null,
});

type MountParams = {
  readonly notification: Notification;
};

const mount = async ({ notification }: MountParams) => {
  render(
    <ToastProvider>
      <NotificationToastBridge />
    </ToastProvider>,
  );
  await act(async () => {
    useAppStore.setState({ notifications: [notification] });
  });
};

describe('NotificationToastBridge acted pointers', () => {
  it('marks a pointer done when its toast action runs', async () => {
    await mount({
      notification: failure({
        id: 'n1',
        action: { kind: 'open-budget', sessionId: SESSION },
      }),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open spend' }));
    });

    const row = useAppStore.getState().notifications[0];
    expect(row?.actedAt).not.toBeNull();
    expect(row?.read).toBe(true);
  });

  it('leaves a retry waiting when its toast action runs', async () => {
    await mount({
      notification: failure({
        id: 'n1',
        action: { kind: 'retry-update' },
      }),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    const row = useAppStore.getState().notifications[0];
    expect(row?.actedAt).toBeNull();
    expect(row?.read).toBe(false);
  });
});
