// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

const { emitNotification } = vi.hoisted(() => ({
  emitNotification: vi.fn(async () => undefined),
}));

vi.mock('../../../store', () => ({
  useAppStore: { getState: () => ({ emitNotification }) },
}));

import { useUnhandledRejectionNotice } from './index';

const rejectionEvent = (reason: unknown): Event =>
  Object.assign(new Event('unhandledrejection'), { reason });

afterEach(() => {
  cleanup();
  emitNotification.mockClear();
  emitNotification.mockImplementation(async () => undefined);
});

describe('useUnhandledRejectionNotice', () => {
  it('turns an unhandled rejection into a notification carrying the failure', async () => {
    renderHook(() => useUnhandledRejectionNotice());

    window.dispatchEvent(rejectionEvent(new Error('agent list refused')));

    await waitFor(() => expect(emitNotification).toHaveBeenCalledTimes(1));
    expect(emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'an action failed in the background',
      'agent list refused',
    );
  });

  it('does not notify again when the notification itself fails', async () => {
    emitNotification.mockImplementation(async () => {
      throw new Error('database is gone');
    });
    renderHook(() => useUnhandledRejectionNotice());

    window.dispatchEvent(rejectionEvent(new Error('agent list refused')));

    await waitFor(() => expect(emitNotification).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(emitNotification).toHaveBeenCalledTimes(1);
  });

  it('stops listening once the app unmounts', () => {
    const { unmount } = renderHook(() => useUnhandledRejectionNotice());
    unmount();

    window.dispatchEvent(rejectionEvent(new Error('agent list refused')));

    expect(emitNotification).not.toHaveBeenCalled();
  });
});
