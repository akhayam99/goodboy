// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNotificationListKeys } from '.';

type PressParams = {
  readonly key: string;
  readonly target?: HTMLElement;
};

const press = ({ key, target }: PressParams) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  (target ?? window).dispatchEvent(event);
};

type SetupParams = {
  readonly selectedKey: string | null;
};

const setup = ({ selectedKey }: SetupParams) => {
  const handlers = { onSelect: vi.fn(), onDismiss: vi.fn(), onActivate: vi.fn() };
  renderHook(() => useNotificationListKeys({ keys: ['a', 'b', 'c'], selectedKey, ...handlers }));
  return handlers;
};

afterEach(cleanup);

describe('useNotificationListKeys', () => {
  it('starts at the top when nothing is selected', () => {
    const fromNone = setup({ selectedKey: null });
    press({ key: 'j' });
    expect(fromNone.onSelect).toHaveBeenLastCalledWith('a');
  });

  it('moves down with j and up with k, clamped to the list', () => {
    const fromLast = setup({ selectedKey: 'c' });
    press({ key: 'j' });
    expect(fromLast.onSelect).toHaveBeenLastCalledWith('c');
    press({ key: 'k' });
    expect(fromLast.onSelect).toHaveBeenLastCalledWith('b');
  });

  it('dismisses with e and runs the action with Enter on the selected row', () => {
    const handlers = setup({ selectedKey: 'b' });

    press({ key: 'e' });
    press({ key: 'Enter' });

    expect(handlers.onDismiss).toHaveBeenCalledWith('b');
    expect(handlers.onActivate).toHaveBeenCalledWith('b');
  });

  it('leaves typing alone', () => {
    const handlers = setup({ selectedKey: 'b' });
    const input = document.createElement('input');
    document.body.append(input);

    press({ key: 'j', target: input });
    press({ key: 'e', target: input });

    expect(handlers.onSelect).not.toHaveBeenCalled();
    expect(handlers.onDismiss).not.toHaveBeenCalled();
    input.remove();
  });
});
