import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { useOpenSession } from './index';

const setCurrentSession = vi.fn<() => Promise<void>>(async () => undefined);
const setActiveLens = vi.fn();

vi.mock('../../../store', () => ({
  useAppStore: (
    selector: (s: {
      setCurrentSession: typeof setCurrentSession;
      setActiveLens: typeof setActiveLens;
    }) => unknown,
  ) => selector({ setCurrentSession, setActiveLens }),
}));

describe('useOpenSession', () => {
  beforeEach(() => {
    setCurrentSession.mockReset();
    setCurrentSession.mockResolvedValue(undefined);
    setActiveLens.mockReset();
  });

  it('sets the active lens after the current session resolves', async () => {
    let resolveCurrentSession: (() => void) | undefined;
    setCurrentSession.mockImplementation(
      async () =>
        new Promise<void>((resolve) => {
          resolveCurrentSession = resolve;
        }),
    );
    const { result } = renderHook(() => useOpenSession());
    let opening: Promise<void> | undefined;

    act(() => {
      opening = result.current({ sessionId: 's1' as SessionId, lens: 'review' });
    });

    expect(setCurrentSession).toHaveBeenCalledWith('s1');
    expect(setActiveLens).not.toHaveBeenCalled();

    await act(async () => {
      resolveCurrentSession?.();
      await opening;
    });

    expect(setActiveLens).toHaveBeenCalledWith('s1', 'review');
  });

  it('does not set an active lens when one is omitted', async () => {
    const { result } = renderHook(() => useOpenSession());

    await act(async () => {
      await result.current({ sessionId: 's2' as SessionId });
    });

    expect(setActiveLens).not.toHaveBeenCalled();
  });

  it('runs onOpened last', async () => {
    const calls: string[] = [];
    setCurrentSession.mockImplementation(async () => {
      calls.push('session');
    });
    setActiveLens.mockImplementation(() => {
      calls.push('lens');
    });
    const onOpened = vi.fn(() => {
      calls.push('opened');
    });
    const { result } = renderHook(() => useOpenSession());

    await act(async () => {
      await result.current({ sessionId: 's3' as SessionId, lens: 'review', onOpened });
    });

    expect(calls).toEqual(['session', 'lens', 'opened']);
  });

  it('does nothing after setting the current session fails', async () => {
    setCurrentSession.mockRejectedValue(new Error('navigation failed'));
    const onOpened = vi.fn();
    const { result } = renderHook(() => useOpenSession());

    await act(async () => {
      await result.current({ sessionId: 's4' as SessionId, lens: 'review', onOpened });
    });

    expect(setActiveLens).not.toHaveBeenCalled();
    expect(onOpened).not.toHaveBeenCalled();
  });
});
