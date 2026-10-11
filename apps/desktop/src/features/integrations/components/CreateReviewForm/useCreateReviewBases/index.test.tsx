// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReviewBases } from '../types';
import { useCreateReviewBases } from './index';

type Deferred = {
  readonly promise: Promise<ReviewBases>;
  readonly resolve: (value: ReviewBases) => void;
  readonly reject: (reason: Error) => void;
};

const deferred = (): Deferred => {
  let resolve: Deferred['resolve'] = () => undefined;
  let reject: Deferred['reject'] = () => undefined;
  const promise = new Promise<ReviewBases>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const bases = ({
  names,
  defaultBranch,
}: {
  names: ReadonlyArray<string>;
  defaultBranch: string;
}) => ({
  defaultBranch,
  branches: names,
});

const noop = (): void => undefined;

describe('useCreateReviewBases', () => {
  it('stops loading and exposes the error when the load fails', async () => {
    const load = vi.fn(async () => {
      throw new Error('remote unreachable');
    });
    const { result } = renderHook(() => useCreateReviewBases({ load, onDefault: noop }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toContain('remote unreachable');
    expect(result.current.branches).toEqual([]);
  });

  it('retries the load and clears the error on success', async () => {
    const load = vi
      .fn<() => Promise<ReviewBases>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(bases({ names: ['main', 'develop'], defaultBranch: 'main' }));
    const onDefault = vi.fn();
    const { result } = renderHook(() => useCreateReviewBases({ load, onDefault }));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.branches).toEqual(['main', 'develop']));
    expect(result.current.error).toBeNull();
    expect(onDefault).toHaveBeenCalledWith('main');
  });

  it('drops a late reply from an older load', async () => {
    const first = deferred();
    const second = deferred();
    const onDefault = vi.fn();
    const { result, rerender } = renderHook(
      ({ load }: { load: () => Promise<ReviewBases> }) => useCreateReviewBases({ load, onDefault }),
      { initialProps: { load: () => first.promise } },
    );

    rerender({ load: () => second.promise });
    await act(async () => {
      second.resolve(bases({ names: ['release'], defaultBranch: 'release' }));
    });
    await act(async () => {
      first.resolve(bases({ names: ['stale'], defaultBranch: 'stale' }));
    });

    expect(result.current.branches).toEqual(['release']);
    expect(onDefault).toHaveBeenCalledTimes(1);
    expect(onDefault).toHaveBeenCalledWith('release');
  });

  it('drops a late failure from an older load', async () => {
    const first = deferred();
    const second = deferred();
    const { result, rerender } = renderHook(
      ({ load }: { load: () => Promise<ReviewBases> }) =>
        useCreateReviewBases({ load, onDefault: noop }),
      { initialProps: { load: () => first.promise } },
    );

    rerender({ load: () => second.promise });
    await act(async () => {
      second.resolve(bases({ names: ['main'], defaultBranch: 'main' }));
    });
    await act(async () => {
      first.reject(new Error('old failure'));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.branches).toEqual(['main']);
  });
});
