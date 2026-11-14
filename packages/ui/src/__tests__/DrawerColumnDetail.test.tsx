// @vitest-environment happy-dom

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DrawerColumn } from '../components/DrawerColumn';
import { DRAWER_INSET, RIGHT_DRAWER_DEFAULT, panelAsideWidthOf } from '../drawerGeometry';
import { DrawerEdgeContext } from '../drawerEdgeContext';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const EDGE_WIDTH = 44;

type ColumnParams = {
  readonly column: number;
};

type RenderParams = {
  readonly dock: string | null;
  readonly detail: string | null;
};

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });
const detailBox = () => panel().querySelector<HTMLElement>('[data-container="detail"]');
const dockBox = () => panel().querySelector<HTMLElement>('[data-container="drawer"]');
const group = () => panel().querySelector<HTMLElement>('[data-detail-group]');
const scrim = () => document.querySelector<HTMLElement>('[data-drawer-scrim]');

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

const stubColumn = ({ column }: ColumnParams) => {
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

const ToolColumn = () => {
  const host = useContext(DrawerEdgeContext);
  const tools = (
    <div role="toolbar" aria-label="Tools">
      <button type="button">Terminal</button>
    </div>
  );
  return host === null ? tools : createPortal(tools, host);
};

const renderFrame = ({ dock, detail }: RenderParams) =>
  render(
    <DrawerColumn
      main={<ToolColumn />}
      drawer={dock === null ? null : <div>{dock}</div>}
      detail={detail === null ? null : <div>{detail}</div>}
      frame="sheet"
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

describe('DrawerColumn with a detail panel and a tool dock', () => {
  it('orders content, detail panel, tool dock and rail from left to right', () => {
    stubColumn({ column: 1600 });
    renderFrame({ dock: 'Terminal output', detail: 'Artifact' });
    const track = group()?.parentElement;
    const children = Array.from(track?.children ?? []);

    expect(children.indexOf(group() as Element)).toBeLessThan(
      children.indexOf(dockBox() as Element),
    );
    expect(detailBox()?.textContent).toBe('Artifact');
    expect(dockBox()?.textContent).toContain('Terminal output');
    expect(dockBox()?.lastElementChild?.hasAttribute('data-drawer-edge')).toBe(true);
  });

  it('draws the dock on the rail surface and the detail panel on the page surface', () => {
    stubColumn({ column: 1600 });
    renderFrame({ dock: 'Terminal output', detail: 'Artifact' });

    expect(dockBox()?.className).toContain('bg-drawer');
    expect(detailBox()?.className).toContain('bg-background');
    expect(detailBox()?.className).not.toContain('bg-drawer');
  });

  it('pushes both together beside a wide page, with no scrim', () => {
    stubColumn({ column: 1600 });
    renderFrame({ dock: 'Terminal output', detail: 'Artifact' });

    expect(panel().dataset['drawerMode']).toBe('push');
    expect(panel().style.width).toBe(
      `${panelAsideWidthOf({ dockWidth: RIGHT_DRAWER_DEFAULT, detailWidth: RIGHT_DRAWER_DEFAULT, railWidth: EDGE_WIDTH })}px`,
    );
    expect(group()?.style.width).toBe(`${RIGHT_DRAWER_DEFAULT + DRAWER_INSET}px`);
    expect(scrim()).toBeNull();
  });

  it('lays both over the page with a scrim below the push width, rail kept in the container', () => {
    stubColumn({ column: 900 });
    renderFrame({ dock: 'Terminal output', detail: 'Artifact' });

    expect(panel().dataset['drawerMode']).toBe('overlay');
    expect(scrim()).not.toBeNull();
    expect(dockBox()?.querySelector('[role="toolbar"]')).not.toBeNull();
  });

  it('opens a lone detail panel between the page and the rail', () => {
    stubColumn({ column: 1600 });
    renderFrame({ dock: null, detail: 'Artifact' });

    expect(panel().dataset['detailOpen']).toBe('');
    expect(panel().style.width).toBe(
      `${panelAsideWidthOf({ dockWidth: 0, detailWidth: RIGHT_DRAWER_DEFAULT, railWidth: EDGE_WIDTH })}px`,
    );
    expect(dockBox()?.querySelector('[data-drawer-card]')).toBeNull();
  });

  it('slides the content column and the detail panel by width with the motion token', () => {
    stubColumn({ column: 1600 });
    renderFrame({ dock: null, detail: 'Artifact' });

    expect(panel().className).toContain('motion-safe:transition-[width]');
    expect(panel().className).toContain('duration-200');
    expect(group()?.className).toContain('motion-safe:transition-[width]');
    expect(group()?.className).toContain('ease-enter');
  });

  it('keeps the detail group at zero width and the dock untouched when no detail is open', () => {
    stubColumn({ column: 1600 });
    renderFrame({ dock: 'Terminal output', detail: null });

    expect(group()?.style.width).toBe('0px');
    expect(panel().dataset['detailOpen']).toBeUndefined();
  });
});
