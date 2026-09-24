// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useAsyncSubscription } from './index';

afterEach(cleanup);

type Deferred = {
  readonly promise: Promise<() => void>;
  readonly resolve: (teardown: () => void) => void;
};

const deferred = (): Deferred => {
  const handle: { resolve: (teardown: () => void) => void } = { resolve: () => undefined };
  const promise = new Promise<() => void>((resolve) => {
    handle.resolve = resolve;
  });
  return { promise, resolve: (teardown) => handle.resolve(teardown) };
};

describe('useAsyncSubscription', () => {
  it('tears the subscription down on unmount once it has started', async () => {
    const teardown = vi.fn();
    const { unmount } = renderHook(() => useAsyncSubscription({ start: async () => teardown }));
    await act(async () => undefined);

    unmount();

    expect(teardown).toHaveBeenCalledOnce();
  });

  it('tears down a subscription that resolves after the owner unmounted', async () => {
    const pending = deferred();
    const teardown = vi.fn();
    const { unmount } = renderHook(() => useAsyncSubscription({ start: () => pending.promise }));

    unmount();
    expect(teardown).not.toHaveBeenCalled();

    await act(async () => pending.resolve(teardown));

    expect(teardown).toHaveBeenCalledOnce();
  });
});
