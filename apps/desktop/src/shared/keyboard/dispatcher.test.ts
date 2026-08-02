// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventMatches, registerShortcut } from './dispatcher';
import { SHORTCUTS } from './registry';

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
  document.body.innerHTML = '';
});

const bind = (id: Parameters<typeof registerShortcut>[0], handler: () => void) => {
  cleanups.push(registerShortcut(id, handler));
};

const press = (init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
};

describe('shortcut dispatcher', () => {
  it('fires a shifted bracket, which the character-based matcher could never see', () => {
    const onPrev = vi.fn();
    bind('session.prev', onPrev);

    press({ key: '{', code: 'BracketLeft', metaKey: true, shiftKey: true });

    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('fires an option letter, which macOS composes into another character', () => {
    const onAgents = vi.fn();
    bind('lens.agents', onAgents);

    press({ key: 'å', code: 'KeyA', metaKey: true, altKey: true });

    expect(onAgents).toHaveBeenCalledOnce();
  });

  it('still fires while the caret sits in a textarea', () => {
    const onPalette = vi.fn();
    bind('palette.open', onPalette);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    press({ key: 'k', code: 'KeyK', metaKey: true });

    expect(onPalette).toHaveBeenCalledOnce();
  });

  it('leaves an unclaimed combo to the browser instead of swallowing it', () => {
    bind('palette.open', vi.fn());

    const event = press({ key: 'k', code: 'KeyK', metaKey: true, altKey: true });

    expect(event.defaultPrevented).toBe(false);
  });

  it('does not confuse two combos that differ only by a modifier', () => {
    const onResolve = vi.fn();
    const onReload = vi.fn();
    bind('lens.resolve', onResolve);
    bind('app.reload', onReload);

    press({ key: 'r', code: 'KeyR', metaKey: true });

    expect(onReload).toHaveBeenCalledOnce();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('stops listening for a shortcut once its owner unmounts', () => {
    const onPalette = vi.fn();
    const off = registerShortcut('palette.open', onPalette);
    off();

    press({ key: 'k', code: 'KeyK', metaKey: true });

    expect(onPalette).not.toHaveBeenCalled();
  });

  it('matches on the physical code and every modifier', () => {
    expect(
      eventMatches(new KeyboardEvent('keydown', { code: 'KeyK', metaKey: true }), 'cmd+KeyK'),
    ).toBe(true);
    expect(
      eventMatches(
        new KeyboardEvent('keydown', { code: 'KeyK', metaKey: true, shiftKey: true }),
        SHORTCUTS['palette.open'].combo,
      ),
    ).toBe(false);
  });
});
