// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEscapeToList } from './index';

afterEach(() => {
  vi.useRealTimers();
});

const press = () => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('useEscapeToList', () => {
  it('goes back to the list on Escape', () => {
    vi.useFakeTimers();
    const onEscape = vi.fn();
    renderHook(() => useEscapeToList({ isActive: true, onEscape }));
    press();
    vi.runAllTimers();
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('leaves Escape to a menu that handles it after this listener ran', () => {
    vi.useFakeTimers();
    const onEscape = vi.fn();
    renderHook(() => useEscapeToList({ isActive: true, onEscape }));
    const closeMenu = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener('keydown', closeMenu);
    press();
    window.removeEventListener('keydown', closeMenu);
    vi.runAllTimers();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('does nothing while inactive', () => {
    vi.useFakeTimers();
    const onEscape = vi.fn();
    renderHook(() => useEscapeToList({ isActive: false, onEscape }));
    press();
    vi.runAllTimers();
    expect(onEscape).not.toHaveBeenCalled();
  });
});
