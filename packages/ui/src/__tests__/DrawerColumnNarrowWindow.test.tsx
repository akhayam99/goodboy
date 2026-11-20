// @vitest-environment happy-dom

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrawerColumn } from '../components/DrawerColumn';
import { DrawerFrame } from '../components/DrawerFrame';
import { DrawerEdgeContext } from '../drawerEdgeContext';
import { RIGHT_DRAWER_DEFAULT, RIGHT_DRAWER_MIN, type DrawerSizing } from '../drawerGeometry';
import { SHELL_RAIL_WIDTH_PX, TOOL_RAIL_WIDTH_PX } from '../components/ShellRail/shellRailGeometry';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const WINDOW_WIDTH = 1024;
const COLUMN_WIDTH = WINDOW_WIDTH - SHELL_RAIL_WIDTH_PX.narrow;

const cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

type EdgeParams = {
  readonly edge: number;
};

const stubWindow = ({ edge }: EdgeParams) => {
  class EdgeObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      const isEdge = target.hasAttribute('data-drawer-edge');
      this.callback([{ contentRect: { width: isEdge ? edge : COLUMN_WIDTH } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', EdgeObserver);
  const original = Element.prototype.getBoundingClientRect;
  const spy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function rectOf(this: Element) {
      const rect = original.call(this);
      return this.hasAttribute('data-drawer-edge') && this.childElementCount > 0
        ? new DOMRect(rect.x, rect.y, edge, rect.height)
        : rect;
    });
  cleanups.push(() => spy.mockRestore());
};

const ToolRail = () => {
  const host = useContext(DrawerEdgeContext);
  const tools = (
    <div role="toolbar" aria-label="Tools">
      <button type="button">Browser</button>
    </div>
  );
  return host === null ? tools : createPortal(tools, host);
};

type OpenParams = {
  readonly sizing: DrawerSizing;
  readonly onClose?: () => void;
};

const openPanel = ({ sizing, onClose = vi.fn() }: OpenParams) =>
  render(
    <DrawerColumn
      main={
        <>
          <ToolRail />
          <button type="button">Board</button>
        </>
      }
      drawer={
        <DrawerFrame title={sizing === 'browser' ? 'Browser' : 'Terminal'} onClose={onClose}>
          <p>Harborline checkout</p>
        </DrawerFrame>
      }
      sizing={sizing}
      frame="sheet"
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });
const scrim = () => document.querySelector<HTMLElement>('[data-drawer-scrim]');
const pageOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-container="page"]');

describe('a 1024 by 700 window', () => {
  it('pushes a narrow panel beside the page once the tool rail turns to icons only', () => {
    stubWindow({ edge: TOOL_RAIL_WIDTH_PX.narrow });
    const { container } = openPanel({ sizing: 'side' });

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(scrim()).toBeNull();
    expect(pageOf(container)?.hasAttribute('inert')).toBe(false);
  });

  it('shrinks the same panel toward its minimum beside the page with the wide tool rail', () => {
    stubWindow({ edge: TOOL_RAIL_WIDTH_PX.wide });
    openPanel({ sizing: 'side' });
    const width = Number.parseFloat(panel().style.getPropertyValue('--goodboy-drawer-panel'));

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(width).toBeLessThan(RIGHT_DRAWER_DEFAULT);
    expect(width).toBeGreaterThanOrEqual(RIGHT_DRAWER_MIN);
  });

  it('lays the Browser over the page, to the left of the rail, with the page still live', () => {
    stubWindow({ edge: TOOL_RAIL_WIDTH_PX.narrow });
    const { container } = openPanel({ sizing: 'browser' });
    const rail = panel().querySelector('[data-drawer-edge]');

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().className).toContain('right-0');
    expect(rail?.parentElement?.lastElementChild).toBe(rail);
    expect(rail?.querySelector('[role="toolbar"]')).not.toBeNull();
    expect(pageOf(container)?.hasAttribute('inert')).toBe(false);
    expect(scrim()).toBeNull();
  });

  it('closes the Browser over the page with Esc when the keyboard is outside the web page', () => {
    stubWindow({ edge: TOOL_RAIL_WIDTH_PX.narrow });
    const onClose = vi.fn();
    openPanel({ sizing: 'browser', onClose });

    screen.getByRole('button', { name: 'Browser' }).focus();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the Browser open over the page when a click lands on the page', () => {
    stubWindow({ edge: TOOL_RAIL_WIDTH_PX.narrow });
    const onClose = vi.fn();
    openPanel({ sizing: 'browser', onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Board' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
  });
});
