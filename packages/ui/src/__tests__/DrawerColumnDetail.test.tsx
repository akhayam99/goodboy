// @vitest-environment happy-dom

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrawerColumn } from '../components/DrawerColumn';
import {
  DRAWER_GUTTER,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MIN,
  panelAsideWidthOf,
} from '../drawerGeometry';
import { DrawerEdgeContext } from '../drawerEdgeContext';
import { RIGHT_DRAWER_STORAGE_KEY } from '../drawerWidthKeys';

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
const pageOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-container="page"]');

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
    const detailGroup = group();
    const dock = dockBox();
    if (detailGroup === null || dock === null) {
      throw new Error('both containers render');
    }
    const children = Array.from(detailGroup.parentElement?.children ?? []);

    expect(children.indexOf(detailGroup)).toBeLessThan(children.indexOf(dock));
    expect(detailBox()?.textContent).toBe('Artifact');
    expect(dockBox()?.textContent).toContain('Terminal output');
    expect(dockBox()?.lastElementChild?.hasAttribute('data-drawer-edge')).toBe(true);
    expect(dockBox()?.firstElementChild?.hasAttribute('data-drawer-card')).toBe(true);
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
    expect(group()?.style.width).toBe(`${RIGHT_DRAWER_DEFAULT + DRAWER_GUTTER}px`);
    expect(scrim()).toBeNull();
  });

  it('lays both over the page with no veil once even the tool cannot push, rail kept', () => {
    stubColumn({ column: 900 });
    const { container } = renderFrame({ dock: 'Terminal output', detail: 'Artifact' });

    expect(panel().dataset['drawerMode']).toBe('overlay');
    expect(scrim()).toBeNull();
    expect(pageOf(container)?.hasAttribute('inert')).toBe(false);
    expect(dockBox()?.querySelector('[role="toolbar"]')).not.toBeNull();
  });

  it('shrinks both toward their minimum beside the page before either floats', () => {
    stubColumn({ column: 1320 + EDGE_WIDTH });
    renderFrame({ dock: 'Terminal output', detail: 'Ask' });

    expect(panel().dataset['drawerMode']).toBe('push');
    expect(panel().dataset['detailOver']).toBeUndefined();
    expect(group()?.style.width).toBe(`${396 + DRAWER_GUTTER}px`);
    expect(panel().style.width).toBe(
      `${panelAsideWidthOf({ dockWidth: RIGHT_DRAWER_MIN, detailWidth: 396, railWidth: EDGE_WIDTH })}px`,
    );
  });

  it('keeps the tool beside the page and floats only the detail, the page still live', () => {
    stubColumn({ column: 1160 + EDGE_WIDTH });
    const { container } = renderFrame({ dock: 'Terminal output', detail: 'Ask' });

    expect(panel().dataset['drawerMode']).toBe('push');
    expect(panel().dataset['detailOver']).toBe('');
    expect(panel().style.width).toBe(
      `${panelAsideWidthOf({ dockWidth: RIGHT_DRAWER_DEFAULT, detailWidth: 0, railWidth: EDGE_WIDTH })}px`,
    );
    expect(group()?.className).toContain('absolute');
    expect(group()?.className).toContain('-translate-x-full');
    expect(detailBox()?.className).toContain('shadow-xl');
    expect(scrim()).toBeNull();
    expect(pageOf(container)?.hasAttribute('inert')).toBe(false);
  });

  it('floats a lone detail over the page without a veil when it cannot push', () => {
    stubColumn({ column: 860 + EDGE_WIDTH });
    const { container } = renderFrame({ dock: null, detail: 'Ask' });

    expect(panel().dataset['detailOver']).toBe('');
    expect(group()?.className).toContain('absolute');
    expect(scrim()).toBeNull();
    expect(pageOf(container)?.hasAttribute('inert')).toBe(false);
  });

  it.each([1600, 1160 + EDGE_WIDTH, 900])(
    'reads page, detail, then tools in document order at a %i column',
    (column) => {
      stubColumn({ column });
      const { container } = renderFrame({ dock: 'Terminal output', detail: 'Ask' });
      const page = pageOf(container);
      const detail = detailBox();
      const dock = dockBox();
      if (page === null || detail === null || dock === null) {
        throw new Error('page, detail and dock render');
      }

      expect(page.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(detail.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    },
  );

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

  it('remembers the width of each kind of detail apart, and resets only that kind', () => {
    stubColumn({ column: 2400 });
    const renderKind = (kind: string) =>
      render(
        <DrawerColumn
          main={<ToolColumn />}
          drawer={null}
          detail={<div>{kind}</div>}
          detailKind={kind}
          frame="sheet"
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />,
      );
    const handle = () => screen.getByRole('separator', { name: 'Resize detail panel' });

    const ask = renderKind('ask');
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    const askWidth = handle().getAttribute('aria-valuenow');
    ask.unmount();
    const context = renderKind('artifact');

    expect(askWidth).not.toBe(String(RIGHT_DRAWER_DEFAULT));
    expect(handle().getAttribute('aria-valuenow')).toBe(String(RIGHT_DRAWER_DEFAULT));
    context.unmount();
    renderKind('ask');
    expect(handle().getAttribute('aria-valuenow')).toBe(askWidth);

    fireEvent.doubleClick(handle());
    expect(handle().getAttribute('aria-valuenow')).toBe(String(RIGHT_DRAWER_DEFAULT));
    expect(localStorage.getItem('goodboy:detail-width:artifact:v1')).toBeNull();
    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBeNull();
  });

  it('starts a kind with no width of its own from the width its size had before the upgrade', () => {
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '480');
    stubColumn({ column: 2400 });
    render(
      <DrawerColumn
        main={<ToolColumn />}
        drawer={null}
        detail={<div>Ask</div>}
        detailKind="ask"
        frame="sheet"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(
      screen.getByRole('separator', { name: 'Resize detail panel' }).getAttribute('aria-valuenow'),
    ).toBe('480');
  });

  it('keeps the detail group at zero width and the dock untouched when no detail is open', () => {
    stubColumn({ column: 1600 });
    renderFrame({ dock: 'Terminal output', detail: null });

    expect(group()?.style.width).toBe('0px');
    expect(panel().dataset['detailOpen']).toBeUndefined();
  });
});
