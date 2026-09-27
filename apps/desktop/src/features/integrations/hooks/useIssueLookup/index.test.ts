// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { forgetIssueLookups, useIssueLookup } from './index';

beforeEach(() => {
  vi.useFakeTimers();
  forgetIssueLookups();
});
afterEach(() => {
  vi.useRealTimers();
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useIssueLookup', () => {
  it('waits 300ms after the last key before it calls', async () => {
    const run = vi.fn(async () => 'CAS-231 found');
    const { result, rerender } = renderHook(
      ({ key }: { readonly key: string | null }) => useIssueLookup({ key, scope: 'ws', run }),
      { initialProps: { key: 'CAS-23' as string | null } },
    );

    rerender({ key: 'CAS-231' });
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(run).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flush();

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ status: 'done', key: 'CAS-231', value: 'CAS-231 found' });
  });

  it('calls at once when asked to, and drops an answer for a key that changed', async () => {
    let resolveFirst: (value: string) => void = () => undefined;
    const run = vi
      .fn<(params: { readonly signal: AbortSignal }) => Promise<string>>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce('second');
    const { result, rerender } = renderHook(
      ({ key }: { readonly key: string }) =>
        useIssueLookup({ key, scope: 'ws', run, immediate: true }),
      { initialProps: { key: 'CAS-1' } },
    );

    rerender({ key: 'CAS-2' });
    resolveFirst('first');
    await flush();

    expect(result.current).toEqual({ status: 'done', key: 'CAS-2', value: 'second' });
  });

  it('answers from the two-minute cache when the same code comes back', async () => {
    const run = vi.fn(async () => 'hit');
    const { rerender } = renderHook(
      ({ key }: { readonly key: string | null }) =>
        useIssueLookup({ key, scope: 'ws', run, immediate: true }),
      { initialProps: { key: 'CAS-231' as string | null } },
    );
    await flush();

    rerender({ key: null });
    rerender({ key: 'CAS-231' });
    await flush();

    expect(run).toHaveBeenCalledTimes(1);
  });
});
