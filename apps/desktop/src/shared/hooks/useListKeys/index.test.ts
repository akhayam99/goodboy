// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useListKeys } from '.';

type PressParams = {
  readonly key: string;
  readonly target?: HTMLElement;
};

const press = ({ key, target }: PressParams) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  (target ?? window).dispatchEvent(event);
  return event;
};

type SetupParams = {
  readonly selectedKey: string | null;
  readonly extraKeys?: Readonly<Record<string, (selectedKey: string | null) => void>>;
  readonly hasDismiss?: boolean;
};

const setup = ({ selectedKey, extraKeys, hasDismiss = true }: SetupParams) => {
  const handlers = { onSelect: vi.fn(), onDismiss: vi.fn(), onActivate: vi.fn() };
  renderHook(() =>
    useListKeys({
      keys: ['a', 'b', 'c'],
      selectedKey,
      onSelect: handlers.onSelect,
      onActivate: handlers.onActivate,
      ...(hasDismiss && { onDismiss: handlers.onDismiss }),
      ...(extraKeys != null && { extraKeys }),
    }),
  );
  return handlers;
};

afterEach(cleanup);

describe('useListKeys', () => {
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

  it('moves with the arrow keys like j and k', () => {
    const handlers = setup({ selectedKey: 'b' });
    press({ key: 'ArrowDown' });
    expect(handlers.onSelect).toHaveBeenLastCalledWith('c');
    press({ key: 'ArrowUp' });
    expect(handlers.onSelect).toHaveBeenLastCalledWith('a');
  });

  it('dismisses with e and runs the action with Enter on the selected row', () => {
    const handlers = setup({ selectedKey: 'b' });

    press({ key: 'e' });
    press({ key: 'Enter' });

    expect(handlers.onDismiss).toHaveBeenCalledWith('b');
    expect(handlers.onActivate).toHaveBeenCalledWith('b');
  });

  it('leaves e alone when the list has no dismiss', () => {
    const handlers = setup({ selectedKey: 'b', hasDismiss: false });

    const event = press({ key: 'e' });

    expect(event.defaultPrevented).toBe(false);
    expect(handlers.onDismiss).not.toHaveBeenCalled();
  });

  it('runs an extra key with the selected row, or null when nothing is selected', () => {
    const open = vi.fn();
    const search = vi.fn();
    setup({ selectedKey: 'b', extraKeys: { o: open } });
    press({ key: 'o' });
    expect(open).toHaveBeenCalledWith('b');

    cleanup();
    setup({ selectedKey: null, extraKeys: { '/': search } });
    const event = press({ key: '/' });
    expect(search).toHaveBeenCalledWith(null);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves typing alone', () => {
    const open = vi.fn();
    const handlers = setup({ selectedKey: 'b', extraKeys: { o: open } });
    const input = document.createElement('input');
    document.body.append(input);

    press({ key: 'j', target: input });
    press({ key: 'e', target: input });
    press({ key: 'o', target: input });

    expect(handlers.onSelect).not.toHaveBeenCalled();
    expect(handlers.onDismiss).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    input.remove();
  });
});
