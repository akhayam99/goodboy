import { describe, expect, it, vi } from 'vitest';

const countNotifications = vi.fn();

vi.mock('@goodboy/db', () => ({ countNotifications }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

const { refreshNotificationCounts } = await import('./refreshNotificationCounts');

type Deferred = {
  readonly promise: Promise<unknown>;
  readonly resolve: (value: unknown) => void;
};

const deferred = (): Deferred => {
  let resolve: (value: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('refreshNotificationCounts', () => {
  it('drops counts that resolve after the workspace changed', async () => {
    const pending = deferred();
    countNotifications.mockReturnValueOnce(pending.promise);
    const state = { currentWorkspaceId: 'ws-a' };
    const set = vi.fn();
    const refresh = refreshNotificationCounts({
      set,
      get: () => state as never,
    });
    state.currentWorkspaceId = 'ws-b';
    pending.resolve({ total: 3 });
    await refresh;
    expect(set).not.toHaveBeenCalled();
  });

  it('stores counts for the workspace it asked about', async () => {
    countNotifications.mockResolvedValueOnce({ total: 2 });
    const set = vi.fn();
    await refreshNotificationCounts({
      set,
      get: () => ({ currentWorkspaceId: 'ws-a' }) as never,
    });
    expect(set).toHaveBeenCalledWith({ notificationCounts: { total: 2 } });
  });
});
