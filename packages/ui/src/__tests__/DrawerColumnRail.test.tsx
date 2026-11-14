// @vitest-environment happy-dom

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrawerColumn } from '../components/DrawerColumn';
import {
  DRAWER_INSET,
  READER_DRAWER_DEFAULT,
  RIGHT_DRAWER_DEFAULT,
  drawerAsideWidthOf,
} from '../drawerGeometry';
import { DrawerEdgeContext } from '../drawerEdgeContext';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const EDGE_WIDTH = 44;

type EdgeWidthsParams = {
  readonly column: number;
};

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });
const card = () => panel().querySelector<HTMLElement>('[data-drawer-card]');
const box = () => panel().querySelector<HTMLElement>('[data-container="drawer"]');
const railHost = () => panel().querySelector<HTMLElement>('[data-drawer-edge]');
const scrim = () => document.querySelector<HTMLElement>('[data-drawer-scrim]');
const pageOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-container="page"]');
const handle = () => screen.queryByRole('separator', { name: 'Resize side panel' });
const handleOf = () => screen.getByRole('separator', { name: 'Resize side panel' });

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

const stubEdgeRect = () => {
  const original = Element.prototype.getBoundingClientRect;
  const spy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function rectOf(this: Element) {
      const rect = original.call(this);
      return this.hasAttribute('data-drawer-edge') && this.childElementCount > 0
        ? new DOMRect(rect.x, rect.y, EDGE_WIDTH, rect.height)
        : rect;
    });
  cleanups.push(() => spy.mockRestore());
};

const stubEdgeWidths = ({ column }: EdgeWidthsParams) => {
  class EdgeObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      const isEdge = target.hasAttribute('data-drawer-edge');
      this.callback([{ contentRect: { width: isEdge ? EDGE_WIDTH : column } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', EdgeObserver);
  stubEdgeRect();
};

const driveEdgeColumn = ({ column }: EdgeWidthsParams) => {
  const callbacks: Array<{ readonly isEdge: boolean; readonly callback: ObserverCallback }> = [];
  class DrivenEdgeObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      const isEdge = target.hasAttribute('data-drawer-edge');
      callbacks.push({ isEdge, callback: this.callback });
      this.callback([{ contentRect: { width: isEdge ? EDGE_WIDTH : column } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', DrivenEdgeObserver);
  stubEdgeRect();
  return (width: number) =>
    act(() => {
      callbacks.forEach(({ isEdge, callback }) => {
        if (!isEdge) {
          callback([{ contentRect: { width } }]);
        }
      });
    });
};

const stubSilentObserver = ({ column }: EdgeWidthsParams) => {
  class SilentEdgeObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      if (!target.hasAttribute('data-drawer-edge')) {
        this.callback([{ contentRect: { width: column } }]);
      }
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', SilentEdgeObserver);
  stubEdgeRect();
};

const renderReaderWithTools = () =>
  render(
    <DrawerColumn
      main={<ToolColumn />}
      drawer={<div>Plan</div>}
      sizing="reader"
      frame="sheet"
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

const ToolColumn = () => {
  const host = useContext(DrawerEdgeContext);
  const tools = (
    <div role="toolbar" aria-label="Session tools">
      <button type="button">Scripts</button>
    </div>
  );
  return host === null ? tools : createPortal(tools, host);
};

const renderWithTools = (drawer: string | null) =>
  render(
    <DrawerColumn
      main={<ToolColumn />}
      drawer={drawer === null ? null : <div>{drawer}</div>}
      frame="sheet"
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

describe('DrawerColumn rail', () => {
  it('keeps the tools clickable above the scrim while a drawer lies over the page at 1100', () => {
    stubEdgeWidths({ column: 852 });
    const { container } = renderWithTools('Scripts');
    const live = railHost()?.querySelector('[role="toolbar"]') ?? null;

    expect(pageOf(container)?.hasAttribute('inert')).toBe(true);
    expect(live).not.toBeNull();
    expect(live?.closest('[inert]')).toBeNull();
    expect(panel().className).toContain('z-20');
    expect(scrim()?.className).toContain('z-10');
  });

  it('draws the tools once, inside the drawer container, in every mode', () => {
    const resize = driveEdgeColumn({ column: 1300 });
    const view = renderWithTools('Scripts');

    expect(screen.getAllByRole('toolbar', { name: 'Session tools' })).toHaveLength(1);
    expect(box()?.contains(railHost())).toBe(true);
    expect(pageOf(view.container)?.querySelector('[role="toolbar"]')).toBeNull();

    resize(852);
    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(screen.getAllByRole('toolbar', { name: 'Session tools' })).toHaveLength(1);
    expect(box()?.contains(railHost())).toBe(true);

    view.rerender(
      <DrawerColumn
        main={<ToolColumn />}
        drawer={null}
        frame="sheet"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );
    expect(screen.getAllByRole('toolbar', { name: 'Session tools' })).toHaveLength(1);
    expect(box()?.contains(railHost())).toBe(true);
  });

  it('closed, is the tools alone: the aside is the 8px gutter and the rail wide, and stays live', () => {
    stubEdgeWidths({ column: 1300 });
    renderWithTools(null);

    expect(panel().style.width).toBe(`${EDGE_WIDTH + DRAWER_INSET}px`);
    expect(panel().hasAttribute('inert')).toBe(false);
    expect(card()).toBeNull();
    expect(handle()).toBeNull();
    expect(railHost()?.closest('[inert]')).toBeNull();
  });

  it('opens the panel inward of the rail: its right edge is the rail left edge', () => {
    stubEdgeWidths({ column: 1300 });
    renderWithTools('Scripts');

    expect(card()?.nextElementSibling).toBe(railHost());
    expect(railHost()?.nextElementSibling).toBeNull();
    expect(box()?.lastElementChild).toBe(railHost());
    expect(panel().style.width).toBe(`${RIGHT_DRAWER_DEFAULT + DRAWER_INSET + EDGE_WIDTH}px`);
  });

  it('never moves the rail: one element, last in the container, closed, pushing and over', () => {
    const resize = driveEdgeColumn({ column: 1300 });
    const view = renderWithTools(null);
    const closedHost = railHost();
    const closedParent = closedHost?.parentElement;

    view.rerender(
      <DrawerColumn
        main={<ToolColumn />}
        drawer={<div>Scripts</div>}
        frame="sheet"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );
    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(railHost()).toBe(closedHost);
    expect(railHost()?.parentElement).toBe(closedParent);

    resize(852);
    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(railHost()).toBe(closedHost);
    expect(railHost()?.parentElement).toBe(closedParent);
    expect(railHost()?.nextElementSibling).toBeNull();
    expect(panel().className).toContain('right-0');
  });

  it('keeps the rail still while a resize drags the panel', () => {
    stubEdgeWidths({ column: 1300 });
    renderWithTools('Scripts');
    const host = railHost();

    fireEvent.mouseDown(handleOf(), { button: 0, clientX: 1000 });
    fireEvent.mouseMove(window, { clientX: 960 });

    expect(railHost()).toBe(host);
    expect(box()?.lastElementChild).toBe(host);
    expect(panel().style.width).toBe(`${RIGHT_DRAWER_DEFAULT + 40 + DRAWER_INSET + EDGE_WIDTH}px`);
    fireEvent.mouseUp(window);
  });

  it('holds the closed width in the flow while the panel lies over the page', () => {
    stubEdgeWidths({ column: 852 });
    const { container } = renderWithTools('Scripts');
    const spacer = container.querySelector<HTMLElement>('[data-drawer-spacer]');

    expect(spacer?.style.width).toBe(`${EDGE_WIDTH + DRAWER_INSET}px`);
    expect(panel().className).toContain('absolute');
  });

  it('ends the overlay at the window edge with the rail inside it, at 1100', () => {
    stubEdgeWidths({ column: 852 });
    renderReaderWithTools();

    expect(panel().className).toContain('right-0');
    expect(panel().style.width).toBe(
      `${drawerAsideWidthOf({ width: READER_DRAWER_DEFAULT, mode: 'overlay', railWidth: EDGE_WIDTH })}px`,
    );
    expect(Number.parseFloat(panel().style.width)).toBeLessThanOrEqual(852 - DRAWER_INSET);
  });

  it('narrows the overlay panel so panel and rail fit a narrow sheet', () => {
    stubEdgeWidths({ column: 640 });
    renderReaderWithTools();

    expect(Number.parseFloat(panel().style.width)).toBeLessThanOrEqual(640 - DRAWER_INSET);
    expect(panel().style.width).toBe(`${640 - DRAWER_INSET}px`);
  });

  it('measures the rail once it mounts, without waiting for an observer', () => {
    stubSilentObserver({ column: 852 });
    renderReaderWithTools();

    expect(panel().style.width).toBe(
      `${drawerAsideWidthOf({ width: READER_DRAWER_DEFAULT, mode: 'overlay', railWidth: EDGE_WIDTH })}px`,
    );
  });

  it.each([
    ['side', 971, 'overlay'],
    ['side', 972, 'push'],
    ['reader', 1387, 'overlay'],
    ['reader', 1388, 'push'],
  ] as const)(
    'gives a %s drawer at a %i column the same mode as before the rail moved: %s',
    (sizing, column, mode) => {
      stubEdgeWidths({ column });
      render(
        <DrawerColumn
          main={<ToolColumn />}
          drawer={<div>Plan</div>}
          sizing={sizing}
          frame="sheet"
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />,
      );

      expect(panel().getAttribute('data-drawer-mode')).toBe(mode);
    },
  );

  it('rounds the page container on all corners whenever the rail is there', () => {
    stubEdgeWidths({ column: 1300 });
    const { container } = renderWithTools(null);

    expect(pageOf(container)?.dataset['sheet']).toBe('pushed');
  });

  it('never animates the rail', () => {
    stubEdgeWidths({ column: 852 });
    renderWithTools('Scripts');

    expect(railHost()?.className).not.toContain('animate');
    expect(card()?.className).toContain('motion-safe:animate-drawer-overlay-in');
  });
});
