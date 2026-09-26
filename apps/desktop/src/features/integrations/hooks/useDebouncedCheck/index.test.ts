// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useDebouncedCheck } from './index';

afterEach(cleanup);

describe('useDebouncedCheck', () => {
  it('stays idle without a key and checks once the key settles', async () => {
    const run = vi.fn(async () => 'Priya Moss');
    const { result, rerender } = renderHook(
      ({ key }: { readonly key: string | null }) => useDebouncedCheck({ key, run, delayMs: 10 }),
      { initialProps: { key: null as string | null } },
    );
    expect(result.current.status).toBe('idle');

    rerender({ key: 'a' });
    rerender({ key: 'ab' });
    expect(result.current.status).toBe('checking');

    await waitFor(() => expect(result.current).toEqual({ status: 'ok', value: 'Priya Moss' }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reports a failed check in words', async () => {
    const run = vi.fn(async () => {
      throw new Error('401 Unauthorized');
    });
    const { result } = renderHook(() => useDebouncedCheck({ key: 'k', run, delayMs: 10 }));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({ error: expect.stringContaining('401') });
  });
});
