// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ToastCard } from './ToastCard';
import type { ToastItem } from './types';

const TOAST: ToastItem = {
  id: 'toast-1',
  kind: 'warning',
  message: 'Checks are failing on payments-api',
  persist: false,
  count: 1,
  revision: 0,
};

const focusState = vi.hoisted(() => ({ hasFocus: true }));

beforeEach(() => {
  vi.useFakeTimers();
  focusState.hasFocus = true;
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focusState.hasFocus);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advance = ({ ms }: { readonly ms: number }) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const moveFocus = ({ hasFocus }: { readonly hasFocus: boolean }) => {
  focusState.hasFocus = hasFocus;
  act(() => {
    window.dispatchEvent(new Event(hasFocus ? 'focus' : 'blur'));
  });
};

describe('a toast while the window is behind other windows', () => {
  it('stays when it arrives while the window is blurred, however long the wait', () => {
    focusState.hasFocus = false;
    const onDismiss = vi.fn();
    render(<ToastCard toast={TOAST} onDismiss={onDismiss} />);

    advance({ ms: 5000 * 10 });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('starts its timer again when the window comes back', () => {
    focusState.hasFocus = false;
    const onDismiss = vi.fn();
    render(<ToastCard toast={TOAST} onDismiss={onDismiss} />);
    advance({ ms: 5000 * 3 });

    moveFocus({ hasFocus: true });
    advance({ ms: 5000 - 1 });
    expect(onDismiss).not.toHaveBeenCalled();
    advance({ ms: 1 });

    expect(onDismiss).toHaveBeenCalledWith({ id: 'toast-1' });
  });

  it('freezes the time left when the window blurs half way, and keeps the rest', () => {
    const onDismiss = vi.fn();
    render(<ToastCard toast={TOAST} onDismiss={onDismiss} />);
    advance({ ms: 5000 / 2 });

    moveFocus({ hasFocus: false });
    advance({ ms: 5000 * 4 });
    expect(onDismiss).not.toHaveBeenCalled();

    moveFocus({ hasFocus: true });
    advance({ ms: 5000 / 2 });

    expect(onDismiss).toHaveBeenCalledWith({ id: 'toast-1' });
  });
});
