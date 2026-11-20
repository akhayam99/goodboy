// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Popover } from '../components/Popover';
import { PopoverPin } from '../components/PopoverPin';
import { OverflowMenu } from '../components/OverflowMenu';
import type { MenuEntry } from '../components/ContextMenu/menuTypes';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type ElementParams = {
  readonly root: Element;
};

const scrollerOf = ({ root }: ElementParams): HTMLElement => {
  const scroller = root.querySelector('.mask-fade-y');
  if (!(scroller instanceof HTMLElement)) {
    throw new Error('scroller not found');
  }
  return scroller;
};

const THIRTY_ROWS: ReadonlyArray<MenuEntry> = Array.from({ length: 30 }, (_, index) => ({
  kind: 'item',
  key: `row-${index}`,
  label: `Open ledger-core report ${index + 1}`,
  onSelect: vi.fn(),
}));

describe('Popover', () => {
  it('keeps the action at the end of an overflowing body', () => {
    render(
      <Popover>
        <div>{Array.from({ length: 40 }, (_, index) => `Row ${index}`)}</div>
        <button type="button">Start</button>
      </Popover>,
    );

    expect(screen.getByRole('button', { name: 'Start' }).closest('footer')).toBeNull();
  });

  it('carries no height bound of its own', () => {
    render(
      <Popover role="menu" ariaLabel="Bounded">
        Row
      </Popover>,
    );

    const popover = screen.getByRole('menu');
    expect(popover.style.maxHeight).toBe('');
    expect(popover.className).not.toContain('max-h-full');
  });

  it('scrolls its content in one fading scroller instead of clipping it', () => {
    render(
      <Popover role="menu" ariaLabel="Plain">
        Row
      </Popover>,
    );

    const popover = screen.getByRole('menu');
    expect(popover.className).not.toContain('overflow-y-auto');
    expect(scrollerOf({ root: popover }).className).toContain('overflow-y-auto');
    expect(popover.querySelectorAll('.mask-fade-y')).toHaveLength(1);
  });

  it('takes the positioned bound from its caller', () => {
    render(
      <Popover role="menu" ariaLabel="Fixed" style={{ maxHeight: 320 }}>
        Row
      </Popover>,
    );

    expect(screen.getByRole('menu').style.maxHeight).toBe('320px');
  });

  it('lets the scroller fill the bounded popover instead of the content', () => {
    render(
      <Popover role="menu" ariaLabel="Scrolling">
        Row
      </Popover>,
    );

    const scroller = scrollerOf({ root: screen.getByRole('menu') });
    expect(scroller.className).toContain('flex-1');
    expect(scroller.className).not.toContain('h-full');
  });

  it('floats above the cards it opens from', () => {
    render(
      <Popover role="menu" ariaLabel="Floating">
        Row
      </Popover>,
    );

    expect(screen.getByRole('menu').className).toContain('bg-floating');
  });

  it('pins a search above the scroller and a row below it', () => {
    render(
      <Popover role="dialog" ariaLabel="Sessions">
        <PopoverPin edge="start">
          <input aria-label="Find a session" />
        </PopoverPin>
        <p>Retry policy for 429s</p>
        <PopoverPin edge="end">
          <button type="button">Open Board</button>
        </PopoverPin>
      </Popover>,
    );

    const popover = screen.getByRole('dialog');
    const scroller = scrollerOf({ root: popover });
    const search = screen.getByRole('textbox', { name: 'Find a session' });
    const board = screen.getByRole('button', { name: 'Open Board' });
    expect(scroller.contains(search)).toBe(false);
    expect(scroller.contains(board)).toBe(false);
    expect(scroller.textContent).toBe('Retry policy for 429s');
    expect(popover.firstElementChild?.contains(search)).toBe(true);
    expect(popover.lastElementChild?.contains(board)).toBe(true);
  });

  it('draws a pin in place when no popover holds it', () => {
    const { container } = render(
      <PopoverPin edge="start">
        <span>Repositories</span>
      </PopoverPin>,
    );

    expect(container.textContent).toBe('Repositories');
  });

  it('scrolls a 30 row menu in a 400px window and fades its bottom edge', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });
    render(<OverflowMenu entries={THIRTY_ROWS} label="Report actions" />);

    fireEvent.click(screen.getByRole('button', { name: 'Report actions' }));

    const menu = screen.getByRole('menu', { name: 'Report actions' });
    const scroller = scrollerOf({ root: document.body });
    expect(scroller.contains(menu)).toBe(true);
    expect(screen.getAllByRole('menuitem')).toHaveLength(30);
    const popover = scroller.closest('[data-dropdown-portal] > div');
    expect(
      popover instanceof HTMLElement ? Number.parseFloat(popover.style.maxHeight) : 0,
    ).toBeLessThan(400);

    Object.defineProperty(scroller, 'scrollHeight', { value: 960, configurable: true });
    Object.defineProperty(scroller, 'clientHeight', { value: 360, configurable: true });
    fireEvent.scroll(scroller);

    expect(scroller.style.getPropertyValue('--fade-bottom')).toBe('12px');
    expect(scroller.style.getPropertyValue('--fade-top')).toBe('0px');
  });
});
