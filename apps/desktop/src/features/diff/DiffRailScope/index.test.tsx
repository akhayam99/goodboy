// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useContext } from 'react';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../test/fakeResizeObserver';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { DiffRailContext } from '../diffRailContext';
import { DiffRailScope } from '.';

const Probe = () => {
  const slot = useContext(DiffRailContext);
  return (
    <>
      <output
        data-testid="slot"
        data-mode={slot.mode}
        data-width={slot.width}
        data-host={slot.host === null ? 'none' : 'host'}
      />
      <button type="button" onClick={() => slot.resizeTo(900)}>
        Drag to 900
      </button>
      <button type="button" onClick={() => slot.resizeTo(100)}>
        Drag to 100
      </button>
    </>
  );
};

let observers: FakeResizeObservers | null = null;
let pane = 0;

const setPane = (width: number): void => {
  pane = width;
  act(() => observers?.resizeAll());
};

const slot = (): HTMLElement => screen.getByTestId('slot');

const renderScope = ({
  width,
  isActive = true,
}: {
  readonly width: number;
  readonly isActive?: boolean;
}) => {
  pane = width;
  const view = render(
    <DiffRailScope isActive={isActive}>
      <Probe />
    </DiffRailScope>,
  );
  return view;
};

beforeEach(() => {
  localStorage.clear();
  observers = installFakeResizeObserver();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, pane, 600),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  observers = null;
});

describe('DiffRailScope', () => {
  it('measures the pane before paint and publishes the mode the width allows', () => {
    renderScope({ width: 1196 });

    expect(slot().dataset['mode']).toBe('strip');
    expect(slot().dataset['width']).toBe('280');
  });

  it.each([
    [1100, 'button'],
    [1127, 'button'],
    [1128, 'strip'],
    [1615, 'strip'],
    [1616, 'docked'],
    [1920, 'docked'],
  ] as const)('is %i wide: %s', (width, mode) => {
    renderScope({ width });

    expect(slot().dataset['mode']).toBe(mode);
  });

  it('follows the pane as it is resized, button then strip then docked', () => {
    renderScope({ width: 1100 });
    expect(slot().dataset['mode']).toBe('button');

    setPane(1300);
    expect(slot().dataset['mode']).toBe('strip');

    setPane(1800);
    expect(slot().dataset['mode']).toBe('docked');

    setPane(1050);
    expect(slot().dataset['mode']).toBe('button');
  });

  it('reads an unmeasured pane as docked, never as a button', () => {
    renderScope({ width: 0 });

    expect(slot().dataset['mode']).toBe('docked');
  });

  it('renders the host as the last child of the pane, only while active', () => {
    const { container, rerender } = renderScope({ width: 1920 });
    const scope = container.querySelector('[data-diff-rail-scope]') as HTMLElement;

    expect(scope.lastElementChild?.getAttribute('data-slot')).toBe('diff-rail-host');
    expect(slot().dataset['host']).toBe('host');

    rerender(
      <DiffRailScope isActive={false}>
        <Probe />
      </DiffRailScope>,
    );
    expect(container.querySelector('[data-slot="diff-rail-host"]')).toBeNull();
    expect(slot().dataset['host']).toBe('none');
  });

  it('keeps the children element when the host comes and goes, so the page never remounts', () => {
    const marker = document.createElement('i');
    const { container, rerender } = renderScope({ width: 1920 });
    const first = container.querySelector('output');
    first?.append(marker);

    rerender(
      <DiffRailScope isActive={false}>
        <Probe />
      </DiffRailScope>,
    );
    rerender(
      <DiffRailScope isActive>
        <Probe />
      </DiffRailScope>,
    );

    expect(container.querySelector('output')).toBe(first);
    expect(first?.contains(marker)).toBe(true);
  });

  it('saves a drag clamped to what still docks, under the key the tree always used', () => {
    renderScope({ width: 1700 });

    fireEvent.click(screen.getByRole('button', { name: 'Drag to 900' }));

    expect(slot().dataset['width']).toBe('322');
    expect(slot().dataset['mode']).toBe('docked');
    expect(localStorage.getItem(STORAGE_KEYS.diffTreeWidth)).toBe('322');
  });

  it('never saves under 240', () => {
    renderScope({ width: 1920 });

    fireEvent.click(screen.getByRole('button', { name: 'Drag to 100' }));

    expect(slot().dataset['width']).toBe('240');
  });

  it('lets a wide saved rail fall to the strip where only a narrower one would dock', () => {
    localStorage.setItem(STORAGE_KEYS.diffTreeWidth, '400');
    renderScope({ width: 1700 });

    expect(slot().dataset['width']).toBe('400');
    expect(slot().dataset['mode']).toBe('strip');

    setPane(1900);
    expect(slot().dataset['mode']).toBe('docked');
  });

  it('opens a legacy saved width of 560 as 400', () => {
    localStorage.setItem(STORAGE_KEYS.diffTreeWidth, '560');
    renderScope({ width: 2200 });

    expect(slot().dataset['width']).toBe('400');
  });

  it('drops its observer when it unmounts', () => {
    const { unmount } = renderScope({ width: 1920 });
    expect(observers?.observedCount()).toBe(1);

    unmount();

    expect(observers?.observedCount()).toBe(0);
  });
});
