// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { registerEscapeLayer } from '@goodboy/ui';
import { useEscapeToList } from './index';

afterEach(() => {
  document.body.replaceChildren();
});

const press = () => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('useEscapeToList', () => {
  it('goes back to the list on Escape', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeToList({ isActive: true, onEscape }));
    press();
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('leaves Escape to a layer opened above it, then takes the next one', () => {
    const onEscape = vi.fn();
    const closeAbove = vi.fn();
    renderHook(() => useEscapeToList({ isActive: true, onEscape }));
    const off = registerEscapeLayer(closeAbove);

    press();
    expect(closeAbove).toHaveBeenCalledOnce();
    expect(onEscape).not.toHaveBeenCalled();

    off();
    press();
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('leaves Escape to a field that handles it', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeToList({ isActive: true, onEscape }));
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();
    field.addEventListener('keydown', (event) => event.preventDefault());
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('stays out of a text field that does not handle it', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeToList({ isActive: true, onEscape }));
    const field = document.createElement('textarea');
    document.body.appendChild(field);
    field.focus();
    press();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('does nothing while inactive', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeToList({ isActive: false, onEscape }));
    press();
    expect(onEscape).not.toHaveBeenCalled();
  });
});
