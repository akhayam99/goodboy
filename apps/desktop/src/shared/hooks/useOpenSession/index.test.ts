import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { useOpenSession } from './index';

const navigate = vi.fn();

vi.mock('../../../store', async () => ({
  useAppStore: (selector: (s: { navigate: typeof navigate }) => unknown) => selector({ navigate }),
  sessionPlace: (await import('../../../store/slices/navigation/place')).sessionPlace,
}));

describe('useOpenSession', () => {
  beforeEach(() => {
    navigate.mockReset();
  });

  it('opens the session on the asked lens in one history voice', () => {
    const { result } = renderHook(() => useOpenSession());

    act(() => {
      result.current({ sessionId: 's1' as SessionId, lens: 'review' });
    });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 's1' as SessionId, lens: 'review' }),
    });
  });

  it('opens the overview when no lens is asked', () => {
    const { result } = renderHook(() => useOpenSession());

    act(() => {
      result.current({ sessionId: 's2' as SessionId });
    });

    expect(navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: 's2' as SessionId }) });
  });

  it('runs onOpened after navigating', () => {
    const calls: string[] = [];
    navigate.mockImplementation(() => {
      calls.push('navigate');
    });
    const onOpened = vi.fn(() => {
      calls.push('opened');
    });
    const { result } = renderHook(() => useOpenSession());

    act(() => {
      result.current({ sessionId: 's3' as SessionId, lens: 'review', onOpened });
    });

    expect(calls).toEqual(['navigate', 'opened']);
  });
});
