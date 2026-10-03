// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pressShortcut, pressKey } from '../../../__tests__/helpers/pressKey';
import type { ShortcutId } from '../../keyboard/registry';
import { useListKeys } from '.';

type PressParams = {
  readonly id: ShortcutId;
  readonly target?: HTMLElement;
};

const press = ({ id, target }: PressParams) =>
  pressShortcut({ id, target: target ?? document.body });

type SetupParams = {
  readonly selectedKey: string | null;
  readonly hasDismiss?: boolean;
  readonly extras?: Partial<{
    onOpenInTool: (selectedKey: string | null) => void;
    onReply: (selectedKey: string | null) => void;
    onStar: (selectedKey: string | null) => void;
    onSearch: (selectedKey: string | null) => void;
  }>;
};

const setup = ({ selectedKey, extras, hasDismiss = true }: SetupParams) => {
  const handlers = { onSelect: vi.fn(), onDismiss: vi.fn(), onActivate: vi.fn() };
  renderHook(() =>
    useListKeys({
      keys: ['a', 'b', 'c'],
      selectedKey,
      onSelect: handlers.onSelect,
      onActivate: handlers.onActivate,
      ...(hasDismiss && { onDismiss: handlers.onDismiss }),
      ...extras,
    }),
  );
  return handlers;
};

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('useListKeys', () => {
  it('starts at the top when nothing is selected', () => {
    const fromNone = setup({ selectedKey: null });
    press({ id: 'list.next' });
    expect(fromNone.onSelect).toHaveBeenLastCalledWith('a');
  });

  it('moves down and up, clamped to the list', () => {
    const fromLast = setup({ selectedKey: 'c' });
    press({ id: 'list.next' });
    expect(fromLast.onSelect).toHaveBeenLastCalledWith('c');
    press({ id: 'list.previous' });
    expect(fromLast.onSelect).toHaveBeenLastCalledWith('b');
  });

  it('moves with the arrow keys like j and k', () => {
    const handlers = setup({ selectedKey: 'b' });
    pressKey({ code: 'ArrowDown', target: document.body });
    expect(handlers.onSelect).toHaveBeenLastCalledWith('c');
    pressKey({ code: 'ArrowUp', target: document.body });
    expect(handlers.onSelect).toHaveBeenLastCalledWith('a');
  });

  it('dismisses and opens the selected row', () => {
    const handlers = setup({ selectedKey: 'b' });

    press({ id: 'list.dismiss' });
    press({ id: 'list.open' });

    expect(handlers.onDismiss).toHaveBeenCalledWith('b');
    expect(handlers.onActivate).toHaveBeenCalledWith('b');
  });

  it('does nothing on a row key when nothing is selected', () => {
    const handlers = setup({ selectedKey: null });

    const open = press({ id: 'list.open' });
    const dismiss = press({ id: 'list.dismiss' });

    expect(open.defaultPrevented).toBe(false);
    expect(dismiss.defaultPrevented).toBe(false);
    expect(handlers.onActivate).not.toHaveBeenCalled();
    expect(handlers.onDismiss).not.toHaveBeenCalled();
  });

  it('leaves the dismiss key alone when the list has no dismiss', () => {
    const handlers = setup({ selectedKey: 'b', hasDismiss: false });

    const event = press({ id: 'list.dismiss' });

    expect(event.defaultPrevented).toBe(false);
    expect(handlers.onDismiss).not.toHaveBeenCalled();
  });

  it('runs a row key with the selected row, or null when nothing is selected', () => {
    const open = vi.fn();
    const search = vi.fn();
    setup({ selectedKey: 'b', extras: { onOpenInTool: open } });
    press({ id: 'list.openInTool' });
    expect(open).toHaveBeenCalledWith('b');

    cleanup();
    setup({ selectedKey: null, extras: { onSearch: search } });
    const event = press({ id: 'list.search' });
    expect(search).toHaveBeenCalledWith(null);
    expect(event.defaultPrevented).toBe(true);
  });

  it('finds the search key on a layout that types the slash with shift', () => {
    const search = vi.fn();
    setup({ selectedKey: 'b', extras: { onSearch: search } });

    pressKey({ code: 'Digit7', key: '/', shift: true, target: document.body });

    expect(search).toHaveBeenCalledWith('b');
  });

  it('runs the star and reply keys with the selected row', () => {
    const star = vi.fn();
    const reply = vi.fn();
    setup({ selectedKey: 'c', extras: { onStar: star, onReply: reply } });

    press({ id: 'list.star' });
    press({ id: 'list.reply' });

    expect(star).toHaveBeenCalledWith('c');
    expect(reply).toHaveBeenCalledWith('c');
  });

  it('leaves typing alone', () => {
    const open = vi.fn();
    const handlers = setup({ selectedKey: 'b', extras: { onOpenInTool: open } });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    press({ id: 'list.next', target: input });
    press({ id: 'list.dismiss', target: input });
    press({ id: 'list.openInTool', target: input });

    expect(handlers.onSelect).not.toHaveBeenCalled();
    expect(handlers.onDismiss).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves Enter to a focused button', () => {
    const handlers = setup({ selectedKey: 'b' });
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();

    const event = press({ id: 'list.open', target: button });

    expect(event.defaultPrevented).toBe(false);
    expect(handlers.onActivate).not.toHaveBeenCalled();
  });

  it('ignores a key pressed with a command modifier', () => {
    const handlers = setup({ selectedKey: 'b' });

    pressKey({ code: 'KeyJ', meta: true, ctrl: true, target: document.body });

    expect(handlers.onSelect).not.toHaveBeenCalled();
  });

  it('stays quiet while a modal dialog is open', () => {
    const handlers = setup({ selectedKey: 'b' });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);

    press({ id: 'list.next' });

    expect(handlers.onSelect).not.toHaveBeenCalled();
  });
});
