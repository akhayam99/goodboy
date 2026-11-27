// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './index';
import type { PreviewNotificationParams } from './toastContext';

type Api = ReturnType<typeof useToast>;

let api: Api | null = null;

const Harness = () => {
  api = useToast();
  return null;
};

const mount = () =>
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

const apiOf = (): Api => {
  if (api === null) {
    throw new Error('the harness is not mounted');
  }
  return api;
};

const failure = (over: Partial<PreviewNotificationParams>): PreviewNotificationParams => ({
  severity: 'error',
  title: 'Push to payments-api failed',
  message: 'The remote rejected the push.',
  persist: true,
  dedupeKey: 'push-failed:session-1',
  notificationIds: ['n1'],
  ...over,
});

const fire = (params: PreviewNotificationParams) => {
  act(() => {
    apiOf().previewNotification(params);
  });
};

const remove = (ids: ReadonlyArray<string>) => {
  act(() => {
    apiOf().removeNotificationIds({ ids: new Set(ids) });
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  api = null;
  vi.useRealTimers();
});

describe('a toast that carries notification ids', () => {
  it('groups rows of one coalesce key into one toast and keeps every id', () => {
    mount();
    fire(failure({ notificationIds: ['n1'] }));
    fire(failure({ notificationIds: ['n2'] }));

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    screen.getByText('×2');
    remove(['n1']);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('×2')).toBeNull();
    remove(['n2']);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps two toasts apart when the coalesce keys differ although the text is the same', () => {
    mount();
    fire(failure({ dedupeKey: 'push-failed:session-1', notificationIds: ['n1'] }));
    fire(failure({ dedupeKey: 'push-failed:session-2', notificationIds: ['n2'] }));

    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('removes the toast when its last id goes and leaves the other toasts', () => {
    mount();
    fire(failure({ dedupeKey: 'a', title: 'First', notificationIds: ['n1'] }));
    fire(failure({ dedupeKey: 'b', title: 'Second', notificationIds: ['n2'] }));

    remove(['n1']);

    expect(screen.queryByText('First')).toBeNull();
    screen.getByText('Second');
  });

  it('never times out an error toast', () => {
    mount();
    fire(failure({}));
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });

    screen.getByRole('alert');
  });

  it('runs onDismiss when the close button hides the toast and does nothing else', () => {
    mount();
    const onDismiss = vi.fn();
    fire(failure({ onDismiss }));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the toast open after an action that says so', () => {
    mount();
    const onClick = vi.fn();
    fire(failure({ action: { label: 'Retry', onClick, isKeptOpen: true } }));

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    screen.getByRole('alert');
  });
});
