// @vitest-environment happy-dom
import { DrawerParkedContext } from '@goodboy/ui';
import { cleanup, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pressKey } from '../../../__tests__/helpers/pressKey';
import { useRowFocusKeys } from '.';

type ListProps = {
  readonly label: string;
  readonly onSearch?: () => void;
  readonly isHidden?: boolean;
};

const List = ({ label, onSearch, isHidden = false }: ListProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useRowFocusKeys({
    containerRef: ref,
    rowSelector: '[data-row]',
    ...(onSearch !== undefined && { onSearch }),
  });
  return (
    <div ref={ref} hidden={isHidden} aria-label={label}>
      <input aria-label={`${label} filter`} />
      <button type="button">{label} toolbar</button>
      <ul>
        <li data-row="a">
          <button type="button">{label} a</button>
        </li>
        <li data-row="b">
          <span>no control</span>
        </li>
        <li data-row="c">
          <button type="button" disabled>
            {label} c disabled
          </button>
        </li>
        <li data-row="d">
          <button type="button">{label} d</button>
          <button type="button">{label} d more</button>
        </li>
      </ul>
    </div>
  );
};

const mount = (node: ReactNode, isParked = false) =>
  render(<DrawerParkedContext.Provider value={isParked}>{node}</DrawerParkedContext.Provider>);

const button = (name: string): HTMLElement => screen.getByRole('button', { name });

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('useRowFocusKeys', () => {
  it('starts on the first row when nothing has the focus', () => {
    mount(<List label="Tasks" />);

    const event = pressKey({ code: 'KeyJ', target: document.body });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button('Tasks a'));
  });

  it('walks over rows that have a control and skips the rest, stopping at both ends', () => {
    mount(<List label="Tasks" />);
    button('Tasks a').focus();

    pressKey({ code: 'KeyJ' });
    expect(document.activeElement).toBe(button('Tasks d'));
    pressKey({ code: 'KeyJ' });
    expect(document.activeElement).toBe(button('Tasks d'));
    pressKey({ code: 'KeyK' });
    expect(document.activeElement).toBe(button('Tasks a'));
    pressKey({ code: 'KeyK' });
    expect(document.activeElement).toBe(button('Tasks a'));
  });

  it('takes the arrows from a row, and leaves them to the page elsewhere', () => {
    mount(<List label="Tasks" />);
    const idle = pressKey({ code: 'ArrowDown', target: document.body });
    expect(idle.defaultPrevented).toBe(false);

    button('Tasks toolbar').focus();
    const toolbar = pressKey({ code: 'ArrowDown' });
    expect(toolbar.defaultPrevented).toBe(false);

    button('Tasks a').focus();
    pressKey({ code: 'ArrowDown' });
    expect(document.activeElement).toBe(button('Tasks d'));
  });

  it('starts on the first row from the toolbar of the list', () => {
    mount(<List label="Tasks" />);
    button('Tasks toolbar').focus();

    pressKey({ code: 'KeyJ' });

    expect(document.activeElement).toBe(button('Tasks a'));
  });

  it('lets the letters type in a field', () => {
    mount(<List label="Tasks" />);
    const field = screen.getByRole('textbox');
    field.focus();

    const event = pressKey({ code: 'KeyJ' });

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(field);
  });

  it('ignores the keys while the focus is on something outside the list', () => {
    mount(
      <>
        <button type="button">Elsewhere</button>
        <List label="Tasks" />
      </>,
    );
    button('Elsewhere').focus();

    const event = pressKey({ code: 'KeyJ' });

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(button('Elsewhere'));
  });

  it('runs the search with the slash, also typed as shift and 7, only when the list has one', () => {
    const onSearch = vi.fn();
    mount(<List label="Tasks" onSearch={onSearch} />);

    const plain = pressKey({ code: 'Slash', target: document.body });
    const italian = pressKey({ code: 'Digit7', key: '/', shift: true, target: document.body });

    expect(plain.defaultPrevented).toBe(true);
    expect(italian.defaultPrevented).toBe(true);
    expect(onSearch).toHaveBeenCalledTimes(2);

    cleanup();
    mount(<List label="Tasks" />);
    expect(pressKey({ code: 'Slash', target: document.body }).defaultPrevented).toBe(false);
  });

  it('does nothing while a drawer parks the list', () => {
    mount(<List label="Tasks" />, true);

    const event = pressKey({ code: 'KeyJ', target: document.body });

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  it('does nothing in a list that is hidden', () => {
    mount(<List label="Tasks" isHidden />);

    const event = pressKey({ code: 'KeyJ', target: document.body });

    expect(event.defaultPrevented).toBe(false);
  });

  it('gives the key to one list when two are open', () => {
    mount(
      <>
        <List label="First" />
        <List label="Second" />
      </>,
    );

    pressKey({ code: 'KeyJ', target: document.body });

    expect(document.activeElement).toBe(button('First a'));
  });

  it('leaves a key with a modifier alone', () => {
    mount(<List label="Tasks" />);

    const event = pressKey({ code: 'KeyJ', meta: true, target: document.body });

    expect(event.defaultPrevented).toBe(false);
  });
});
