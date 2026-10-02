import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

const { build } = vi.hoisted(() => ({ build: vi.fn() }));

vi.mock('../../buildResolveQueueRows', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../buildResolveQueueRows')>();
  build.mockImplementation(actual.buildResolveQueueRows);
  return { ...actual, buildResolveQueueRows: build };
});

import { useResolveQueueRows } from './index';

const SESSION_ID = 'session-1' as SessionId;

describe('useResolveQueueRows', () => {
  beforeEach(() => {
    build.mockClear();
  });

  it('builds the rows once and keeps them across renders', () => {
    const { result, rerender } = renderHook(() => useResolveQueueRows({ sessionId: SESSION_ID }));
    const first = result.current;
    rerender();
    rerender();

    expect(build).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(first);
  });

  it('builds nothing while it is disabled', () => {
    const { result, rerender } = renderHook(() =>
      useResolveQueueRows({ sessionId: SESSION_ID, isEnabled: false }),
    );
    rerender();

    expect(build).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('builds the rows when it switches on', () => {
    const { rerender } = renderHook(
      ({ isEnabled }: { readonly isEnabled: boolean }) =>
        useResolveQueueRows({ sessionId: SESSION_ID, isEnabled }),
      { initialProps: { isEnabled: false } },
    );
    expect(build).not.toHaveBeenCalled();
    rerender({ isEnabled: true });

    expect(build).toHaveBeenCalledTimes(1);
  });
});
