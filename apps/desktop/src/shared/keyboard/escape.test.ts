// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { escapeLayerCount, registerEscapeLayer } from './escape';

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

const layer = (handler: () => void): (() => void) => {
  const off = registerEscapeLayer(handler);
  cleanups.push(off);
  return off;
};

const press = (init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { code: 'Escape', cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
};

describe('escape layers', () => {
  it('closes only the surface on top, one press at a time', () => {
    const closeUnder = vi.fn();
    const closeOver = vi.fn();
    layer(closeUnder);
    layer(closeOver);

    expect(press().defaultPrevented).toBe(true);
    expect(closeOver).toHaveBeenCalledOnce();
    expect(closeUnder).not.toHaveBeenCalled();
  });

  it('leaves the key alone when nothing is open', () => {
    expect(press().defaultPrevented).toBe(false);
  });

  it('ignores escape carrying a modifier', () => {
    const close = vi.fn();
    layer(close);

    for (const modifier of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'] as const) {
      const event = press({ [modifier]: true });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(close).not.toHaveBeenCalled();
  });

  it('yields to a focused editor that already claimed the key', () => {
    const close = vi.fn();
    layer(close);

    const event = new KeyboardEvent('keydown', { code: 'Escape', cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);

    expect(close).not.toHaveBeenCalled();
  });

  it('ignores escape while an input method is composing', () => {
    const close = vi.fn();
    layer(close);

    press({ isComposing: true } as KeyboardEventInit);

    expect(close).not.toHaveBeenCalled();
  });

  it('keeps the order when a surface in the middle unmounts without closing', () => {
    const first = vi.fn();
    const middle = vi.fn();
    const last = vi.fn();
    layer(first);
    const offMiddle = layer(middle);
    const offLast = layer(last);

    offMiddle();
    press();
    expect(last).toHaveBeenCalledOnce();

    offLast();
    press();
    expect(first).toHaveBeenCalledOnce();
    expect(middle).not.toHaveBeenCalled();
  });

  it('swallows the key for a busy surface instead of closing the one underneath', () => {
    const closeUnder = vi.fn();
    layer(closeUnder);
    layer(() => undefined);

    expect(press().defaultPrevented).toBe(true);
    expect(closeUnder).not.toHaveBeenCalled();
  });

  it('stops listening once the last layer goes and picks up again after', () => {
    const off = layer(vi.fn());
    off();
    expect(escapeLayerCount()).toBe(0);
    expect(press().defaultPrevented).toBe(false);

    const close = vi.fn();
    layer(close);
    press();
    expect(close).toHaveBeenCalledOnce();
  });
});
