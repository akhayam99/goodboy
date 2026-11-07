import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchAfterNavigation } from './dispatchAfterNavigation';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('dispatchAfterNavigation', () => {
  it('dispatches the named event and detail after navigation settles', () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    window.addEventListener('goodboy:reveal-chat', listener, { once: true });
    const detail = { name: 'Harborline' };

    dispatchAfterNavigation({ name: 'goodboy:reveal-chat', detail });

    expect(listener).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'goodboy:reveal-chat', detail }),
    );
  });

  it('drops a pending event when the browser environment has gone away', () => {
    vi.useFakeTimers();
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    dispatchAfterNavigation({ name: 'goodboy:reveal-chat' });
    vi.stubGlobal('window', undefined);

    expect(() => vi.runAllTimers()).not.toThrow();
    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
  });
});
