// @vitest-environment happy-dom

import { createRef, useContext } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockGrid } from '../components/DockGrid';
import { DrawerFrame } from '../components/DrawerFrame';
import { DockCellContext } from '../dockCellContext';
import type { DockGridSpec } from '../dockGridSpec';
import { SPLIT_DRAG_ATTRIBUTE } from '../splitDragAttribute';

const RECTS: Readonly<Record<string, DOMRect>> = {
  terminal: new DOMRect(0, 0, 400, 600),
  browser: new DOMRect(412, 0, 400, 600),
};

const GRID = new DOMRect(0, 0, 812, 600);

const GridCell = () => {
  const key = useContext(DockCellContext) ?? 'none';
  return (
    <DrawerFrame title={key === 'terminal' ? 'Terminal' : 'Browser'} onClose={() => undefined}>
      <p>{key}</p>
    </DrawerFrame>
  );
};

type RenderParams = {
  readonly isRoomy?: boolean;
  readonly isWide?: boolean;
};

const renderGrid = ({ isRoomy = true, isWide = false }: RenderParams = {}) => {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: Element,
  ) {
    if (this.hasAttribute('data-dock-grid')) {
      return GRID;
    }
    const key = this.getAttribute('data-dock-pane');
    return key === null ? original.call(this) : (RECTS[key] ?? original.call(this));
  });
  const onMove = vi.fn();
  const spec: DockGridSpec = {
    columns: [[{ key: 'terminal', sizing: 'side' }], [{ key: 'browser', sizing: 'browser' }]],
    focus: 'page',
    onFocus: () => undefined,
    onMove,
  };
  render(
    <DockGrid
      gridRef={createRef<HTMLDivElement>()}
      spec={spec}
      cell={<GridCell />}
      columns={[
        { width: 400, dragMax: 600, panes: [{ key: 'terminal', weight: 1 }] },
        { width: 400, dragMax: 600, panes: [{ key: 'browser', weight: 1 }] },
      ]}
      handles={[]}
      isFramed
      isFocusShown={false}
      isFloating={false}
      canDrop={() => isRoomy}
      boxesOf={() =>
        isWide
          ? [
              {
                width: 900,
                dragMax: 900,
                panes: [{ key: 'browser', weight: 1, tabs: ['browser', 'terminal'] }],
              },
            ]
          : null
      }
    />,
  );
  return { onMove };
};

type PointerParams = {
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly isHeld?: boolean;
  readonly isAlt?: boolean;
};

const pointer = ({ type, x, y, isHeld = true, isAlt = false }: PointerParams) => {
  act(() => {
    window.dispatchEvent(
      new MouseEvent(type, {
        clientX: x,
        clientY: y,
        button: 0,
        buttons: isHeld ? 1 : 0,
        altKey: isAlt,
      }),
    );
  });
};

const nextFrame = async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
};

const pressTerminal = () => {
  const source = document.querySelector<HTMLElement>(
    '[data-dock-pane="terminal"] [data-dock-drag-source]',
  );
  if (source === null) {
    throw new Error('the Terminal head is a drag source');
  }
  fireEvent.pointerDown(source, { clientX: 200, clientY: 20, button: 0, buttons: 1 });
};

const dragTo = async ({ x, y }: Pick<PointerParams, 'x' | 'y'>) => {
  pressTerminal();
  pointer({ type: 'pointermove', x, y });
  await nextFrame();
};

const labelsOf = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('[data-dock-zone-label]')).map(
    (card) => card.getAttribute('data-dock-zone-label') ?? '',
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
});

describe('dragging a panel by its head', () => {
  it('merges the panel into another one from the middle of it', async () => {
    const { onMove } = renderGrid();

    await dragTo({ x: 600, y: 300 });

    expect(document.body.getAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe('move');
    pointer({ type: 'pointerup', x: 600, y: 300, isHeld: false });

    expect(onMove).toHaveBeenCalledWith({
      key: 'terminal',
      unit: 'cell',
      target: { at: 'tab', key: 'browser' },
    });
    expect(document.body.hasAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe(false);
  });

  it('draws the ghost of a merge over the panel it merges into', async () => {
    renderGrid({ isWide: true });

    await dragTo({ x: 600, y: 300 });

    const ghost = document.querySelector<HTMLElement>('[data-dock-ghost]');
    expect(ghost?.style.left).toBe(`${(RECTS.browser?.x ?? 0) + 5}px`);
    expect(ghost?.style.width).toBe(`${(RECTS.browser?.width ?? 0) - 10}px`);
  });

  it('places the panel above another one from its top quarter', async () => {
    const { onMove } = renderGrid();

    await dragTo({ x: 600, y: 50 });
    pointer({ type: 'pointerup', x: 600, y: 50, isHeld: false });

    expect(onMove).toHaveBeenCalledWith({
      key: 'terminal',
      unit: 'cell',
      target: { at: 'above', key: 'browser' },
    });
  });

  it('places the panel at the right edge of the dock', async () => {
    const { onMove } = renderGrid();

    await dragTo({ x: 790, y: 300 });
    pointer({ type: 'pointerup', x: 790, y: 300, isHeld: false });

    expect(onMove).toHaveBeenCalledWith({
      key: 'terminal',
      unit: 'cell',
      target: { at: 'beside', key: 'browser', side: 'after' },
    });
  });

  it('swaps the two panels when Option is held over Merge', async () => {
    const { onMove } = renderGrid();

    await dragTo({ x: 600, y: 300 });
    pointer({ type: 'pointerup', x: 600, y: 300, isHeld: false, isAlt: true });

    expect(onMove).toHaveBeenCalledWith({
      key: 'terminal',
      unit: 'cell',
      target: { at: 'swap', key: 'browser' },
    });
  });

  it('offers only the cards that change the layout, in the five fixed words', async () => {
    renderGrid();

    await dragTo({ x: 600, y: 300 });

    expect(labelsOf()).toEqual(['Place above', 'Merge', 'Place below', 'Place right']);
    expect(screen.queryByText('Place left')).toBeNull();
  });

  it('offers no card where the page would lose its room, and drops nothing', async () => {
    const { onMove } = renderGrid({ isRoomy: false });

    await dragTo({ x: 600, y: 300 });

    expect(labelsOf()).toEqual([]);
    pointer({ type: 'pointerup', x: 600, y: 300, isHeld: false });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('keeps the page undimmed and the Browser cover signal up while dragging', async () => {
    renderGrid();

    await dragTo({ x: 600, y: 300 });

    expect(document.querySelector('[data-dock-dim]')).toBeNull();
    expect(document.body.getAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe('move');
  });

  it('clears the live line when the pointer leaves every card', async () => {
    renderGrid();

    await dragTo({ x: 600, y: 300 });
    expect(document.querySelector('[data-dock-status]')?.textContent).toContain('Merge into');

    pointer({ type: 'pointermove', x: 200, y: 300 });
    await nextFrame();

    expect(document.querySelector('[data-dock-status]')?.textContent).toBe(
      'Drop on a highlighted area, Esc to cancel.',
    );
  });

  it('waits 80 ms before the ghost moves to another card', async () => {
    renderGrid();

    await dragTo({ x: 600, y: 300 });
    pointer({ type: 'pointermove', x: 600, y: 50 });
    await nextFrame();
    expect(document.querySelector('[data-dock-zone-hovered]')?.getAttribute('data-dock-zone')).toBe(
      'merge:browser',
    );

    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-dock-zone-hovered]')?.getAttribute('data-dock-zone'),
      ).toBe('above:browser'),
    );
  });

  it('walks the cards with the arrows and drops on Enter, choosing nothing before', async () => {
    const { onMove } = renderGrid();

    await dragTo({ x: 100, y: 300 });
    const grid = document.querySelector('[data-dock-grid]');
    if (grid === null) {
      throw new Error('the grid is drawn');
    }
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(document.querySelector('[data-dock-status]')?.textContent).toBe(
      'Place above Browser, 1 of 4',
    );
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(document.querySelector('[data-dock-zone-hovered]')?.getAttribute('data-dock-zone')).toBe(
      'merge:browser',
    );
    fireEvent.keyDown(grid, { key: 'Enter' });

    expect(onMove).toHaveBeenCalledWith({
      key: 'terminal',
      unit: 'cell',
      target: { at: 'tab', key: 'browser' },
    });
  });

  it('draws every pill with the label of its zone and the target of its drop', async () => {
    renderGrid();

    await dragTo({ x: 100, y: 300 });

    const pill = document.querySelector('[data-dock-zone="above:browser"]');
    expect(pill?.getAttribute('data-dock-zone-label')).toBe('Place above');
    expect(pill?.textContent).toBe('Place above');
  });

  it('cancels with Esc', async () => {
    const { onMove } = renderGrid();

    await dragTo({ x: 600, y: 300 });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    pointer({ type: 'pointerup', x: 600, y: 300, isHeld: false });

    expect(onMove).not.toHaveBeenCalled();
    expect(document.querySelector('[data-dock-drop]')).toBeNull();
  });

  it('cancels when the window loses focus', async () => {
    const { onMove } = renderGrid();

    await dragTo({ x: 600, y: 300 });
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    pointer({ type: 'pointerup', x: 600, y: 300, isHeld: false });

    expect(onMove).not.toHaveBeenCalled();
    expect(document.querySelector('[data-dock-drop]')).toBeNull();
  });

  it('cancels when the pointer is cancelled', async () => {
    const { onMove } = renderGrid();

    await dragTo({ x: 600, y: 300 });
    pointer({ type: 'pointercancel', x: 600, y: 300, isHeld: false });
    pointer({ type: 'pointerup', x: 600, y: 300, isHeld: false });

    expect(onMove).not.toHaveBeenCalled();
    expect(document.body.hasAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe(false);
  });

  it('cancels when a move arrives with no button held', async () => {
    const { onMove } = renderGrid();

    await dragTo({ x: 600, y: 300 });
    pointer({ type: 'pointermove', x: 610, y: 300, isHeld: false });
    pointer({ type: 'pointerup', x: 610, y: 300, isHeld: false });

    expect(onMove).not.toHaveBeenCalled();
    expect(document.body.hasAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe(false);
  });

  it('starts nothing under 4px, so a click on the head stays a click', () => {
    const { onMove } = renderGrid();

    pressTerminal();
    pointer({ type: 'pointermove', x: 202, y: 21 });
    pointer({ type: 'pointerup', x: 202, y: 21, isHeld: false });

    expect(onMove).not.toHaveBeenCalled();
    expect(document.body.hasAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe(false);
  });
});
