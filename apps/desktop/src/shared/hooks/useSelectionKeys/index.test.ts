// @vitest-environment happy-dom
import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pressShortcut } from '../../../__tests__/helpers/pressKey';
import { useSelectionKeys } from '.';

const build = () => {
  const container = document.createElement('div');
  container.innerHTML =
    '<div data-select-id="a"><button type="button">A</button></div><div data-select-id="b"><button type="button">B</button></div>';
  document.body.append(container);
  return container;
};

const setup = ({ hasSelection = false }: { readonly hasSelection?: boolean } = {}) => {
  const container = build();
  const handlers = { onToggle: vi.fn(), onSelectAll: vi.fn(), onDelete: vi.fn() };
  const containerRef = { current: container };
  renderHook(() => useSelectionKeys({ containerRef, hasSelection, ...handlers }));
  return { container, handlers };
};

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('useSelectionKeys', () => {
  it('toggles the row under the pointer with X', () => {
    const { container, handlers } = setup();

    fireEvent.mouseOver(container.querySelectorAll('[data-select-id]')[1] as Element);
    pressShortcut({ id: 'selection.toggle', target: document.body });

    expect(handlers.onToggle).toHaveBeenCalledWith('b');
  });

  it('prefers the focused row over the hovered one', () => {
    const { container, handlers } = setup();
    fireEvent.mouseOver(container.querySelectorAll('[data-select-id]')[1] as Element);

    const first = container.querySelector('[data-select-id="a"] button') as HTMLElement;
    first.focus();
    pressShortcut({ id: 'selection.toggle', target: first });

    expect(handlers.onToggle).toHaveBeenCalledWith('a');
  });

  it('ignores the keys when the pointer and the focus are elsewhere', () => {
    const { handlers } = setup({ hasSelection: true });
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();

    pressShortcut({ id: 'selection.toggle', target: outside });
    pressShortcut({ id: 'selection.all', target: outside });
    pressShortcut({ id: 'selection.delete', target: outside });

    expect(handlers.onToggle).not.toHaveBeenCalled();
    expect(handlers.onSelectAll).not.toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });

  it('selects every row with the select all key while the pointer is over the list', () => {
    const { container, handlers } = setup();
    fireEvent.mouseOver(container.querySelector('[data-select-id="a"]') as Element);

    const event = pressShortcut({ id: 'selection.all', target: document.body });

    expect(handlers.onSelectAll).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves the select all key to a text field', () => {
    const { container, handlers } = setup();
    fireEvent.mouseOver(container.querySelector('[data-select-id="a"]') as Element);
    const field = document.createElement('input');
    container.append(field);
    field.focus();

    pressShortcut({ id: 'selection.all', target: field });
    pressShortcut({ id: 'selection.toggle', target: field });

    expect(handlers.onSelectAll).not.toHaveBeenCalled();
    expect(handlers.onToggle).not.toHaveBeenCalled();
  });

  it('deletes only when something is selected', () => {
    const { container, handlers } = setup({ hasSelection: false });
    fireEvent.mouseOver(container.querySelector('[data-select-id="a"]') as Element);
    pressShortcut({ id: 'selection.delete', target: document.body });
    expect(handlers.onDelete).not.toHaveBeenCalled();

    cleanup();
    const withSelection = setup({ hasSelection: true });
    fireEvent.mouseOver(withSelection.container.querySelector('[data-select-id="a"]') as Element);
    pressShortcut({ id: 'selection.delete', target: document.body });
    expect(withSelection.handlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it('yields to an open modal dialog', () => {
    const { container, handlers } = setup();
    fireEvent.mouseOver(container.querySelector('[data-select-id="a"]') as Element);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);

    pressShortcut({ id: 'selection.toggle', target: document.body });

    expect(handlers.onToggle).not.toHaveBeenCalled();
  });
});
