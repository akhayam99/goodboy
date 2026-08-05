// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: { emitNotification: vi.fn(async () => undefined) },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T>(selector: (s: typeof state) => T) => selector(state),
}));

import { useStartAnywayConfirm } from './index';

afterEach(() => {
  cleanup();
  state.emitNotification.mockClear();
});

describe('useStartAnywayConfirm', () => {
  it('names the failure and frees the control when the start rejects', async () => {
    const onStart = vi.fn(async () => {
      throw new Error('open questions are waiting for an answer');
    });
    const { result } = renderHook(() => useStartAnywayConfirm({ blockReason: null, onStart }));

    act(() => result.current.onTrigger());

    await waitFor(() => expect(state.emitNotification).toHaveBeenCalledTimes(1));
    expect(state.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'the next step did not start',
      'open questions are waiting for an answer',
    );
    expect(result.current.isBusy).toBe(false);
  });

  it('stays silent when the start resolves', async () => {
    const onStart = vi.fn(async () => undefined);
    const { result } = renderHook(() => useStartAnywayConfirm({ blockReason: null, onStart }));

    act(() => result.current.onTrigger());

    await waitFor(() => expect(onStart).toHaveBeenCalledWith({ isConfirmed: false }));
    expect(state.emitNotification).not.toHaveBeenCalled();
  });

  it('arms the confirmation instead of starting while a blocker stands', () => {
    const onStart = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useStartAnywayConfirm({ blockReason: 'questions', onStart }),
    );

    act(() => result.current.onTrigger());

    expect(onStart).not.toHaveBeenCalled();
    expect(result.current.isConfirming).toBe(true);
  });
});
