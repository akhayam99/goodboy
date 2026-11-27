// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Notification } from '@goodboy/db';
import { ToastProvider } from '../../../../shared/components/Toast';
import { registerActionRetry } from '../../../../store/slices/notifications/actionRetries';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { isoDateTimeOf } from '../../../../__tests__/helpers/brandedIds';
import { NotificationToastBridge } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
});

afterEach(cleanup);

type RowParams = {
  readonly id: string;
  readonly key: string;
  readonly retryId?: string;
};

const failure = ({ id, key, retryId }: RowParams): Notification => ({
  id,
  ts: isoDateTimeOf({ value: new Date(Date.now() + 60_000).toISOString() }),
  kind: 'error',
  title: `Push to payments-api failed ${key}`,
  body: 'The remote rejected the push.',
  severity: 'error',
  sessionId: null,
  workspaceId: null,
  read: false,
  action: retryId === undefined ? null : { kind: 'retry-action', retryId },
  coalesceKey: key,
  actedAt: null,
});

const mount = () =>
  render(
    <ToastProvider>
      <NotificationToastBridge />
    </ToastProvider>,
  );

const setRows = async ({ rows }: { readonly rows: ReadonlyArray<Notification> }) => {
  await act(async () => {
    useAppStore.setState({ notifications: rows });
  });
};

describe('a toast linked to its notification rows', () => {
  it('shows one toast for a failure and keeps it with no timeout', async () => {
    vi.useFakeTimers();
    mount();
    await setRows({ rows: [failure({ id: 'n1', key: 'push:a' })] });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    vi.useRealTimers();
  });

  it('removes the toast when its row is resolved while it is shown', async () => {
    mount();
    await setRows({ rows: [failure({ id: 'n1', key: 'push:a' })] });
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    await act(async () => {
      await useAppStore.getState().resolveNotifications(['push:a']);
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('removes the toast when the row is read in the bell', async () => {
    mount();
    const row = failure({ id: 'n1', key: 'push:a' });
    await setRows({ rows: [row] });

    await setRows({ rows: [{ ...row, read: true }] });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('removes the toast when a sweep took the row off the list', async () => {
    mount();
    await setRows({ rows: [failure({ id: 'n1', key: 'push:a' })] });

    await setRows({ rows: [] });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('swaps the toast when a new row of the same key replaces the old one', async () => {
    mount();
    await setRows({ rows: [failure({ id: 'n1', key: 'push:a' })] });

    await setRows({ rows: [failure({ id: 'n2', key: 'push:a' })] });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(/×2/)).toBeNull();
  });

  it('leaves the row unread and writes nothing when the toast is dismissed', async () => {
    mount();
    await setRows({ rows: [failure({ id: 'n1', key: 'push:a' })] });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(useAppStore.getState().notifications[0]?.read).toBe(false);
    expect(storySpies.markNotificationRead).not.toHaveBeenCalled();
    expect(storySpies.deleteNotification).not.toHaveBeenCalled();
    expect(storySpies.deleteNotificationsByCoalesceKey).not.toHaveBeenCalled();
  });

  it('keeps the toast when the resolve write fails', async () => {
    mount();
    await setRows({ rows: [failure({ id: 'n1', key: 'push:a' })] });
    storySpies.deleteNotificationsByCoalesceKey.mockRejectedValueOnce(
      new Error('database is locked'),
    );

    await act(async () => {
      await useAppStore
        .getState()
        .resolveNotifications(['push:a'])
        .catch(() => undefined);
    });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(useAppStore.getState().notifications).toHaveLength(1);
  });
});

describe('Retry on a linked toast', () => {
  const retryRow = ({ retry }: { readonly retry: () => Promise<boolean> }): Notification => {
    const retryId = registerActionRetry({ retry });
    return failure({ id: 'n1', key: 'push:a', retryId });
  };

  it('resolves the row and removes the toast in one step when the retry completes', async () => {
    mount();
    await setRows({ rows: [retryRow({ retry: async () => true })] });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(storySpies.deleteNotificationsByCoalesceKey).toHaveBeenCalledWith(
      expect.objectContaining({ coalesceKeys: ['push:a'] }),
    );
    expect(useAppStore.getState().notifications).toEqual([]);
  });

  it('keeps the toast and the row when the state changed since and the retry did nothing', async () => {
    mount();
    await setRows({ rows: [retryRow({ retry: async () => false })] });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(storySpies.deleteNotificationsByCoalesceKey).not.toHaveBeenCalled();
    expect(useAppStore.getState().notifications).toHaveLength(1);
  });

  it('settles again without repeating the retry after a failed resolve write', async () => {
    const retry = vi.fn(async () => true);
    mount();
    await setRows({ rows: [retryRow({ retry })] });
    storySpies.deleteNotificationsByCoalesceKey.mockRejectedValueOnce(
      new Error('database is locked'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    await waitFor(() =>
      expect(storySpies.deleteNotificationsByCoalesceKey).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await waitFor(() =>
      expect(storySpies.deleteNotificationsByCoalesceKey).toHaveBeenCalledTimes(2),
    );
    expect(retry).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().notifications.some((row) => row.id === 'n1')).toBe(false);
  });

  it('keeps the toast and the row and reports the error when the outcome is uncertain', async () => {
    mount();
    await setRows({
      rows: [
        retryRow({
          retry: async () => {
            throw new Error('the remote did not answer');
          },
        }),
      ],
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .notifications.some((row) => row.title === "Couldn't finish the retry"),
      ).toBe(true),
    );
    expect(storySpies.deleteNotificationsByCoalesceKey).not.toHaveBeenCalled();
    expect(useAppStore.getState().notifications.some((row) => row.id === 'n1')).toBe(true);
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps the toast and the row when the retry worked but the resolve write failed', async () => {
    mount();
    await setRows({ rows: [retryRow({ retry: async () => true })] });
    storySpies.deleteNotificationsByCoalesceKey.mockRejectedValueOnce(
      new Error('database is locked'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await waitFor(() =>
      expect(
        useAppStore
          .getState()
          .notifications.some((row) => row.title === "Couldn't finish the retry"),
      ).toBe(true),
    );
    expect(useAppStore.getState().notifications.some((row) => row.id === 'n1')).toBe(true);
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1);
  });
});

describe('a success notice', () => {
  it('shows a transient toast and writes no row', async () => {
    vi.useFakeTimers();
    mount();

    await act(async () => {
      await useAppStore.getState().emitNotification({
        kind: 'pr-created',
        severity: 'success',
        title: 'Pull request opened',
      });
    });

    screen.getByText('Pull request opened');
    expect(storySpies.insertNotification).not.toHaveBeenCalled();
    expect(useAppStore.getState().notifications).toEqual([]);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText('Pull request opened')).toBeNull();
    vi.useRealTimers();
  });
});
