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
};

const renderGrid = ({ isRoomy = true }: RenderParams = {}) => {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: Element,
  ) {
    const key = this.getAttribute('data-dock-pane');
    return key === null ? original.call(this) : (RECTS[key] ?? original.call(this));
  });
  const onMove = vi.fn();
  const spec: DockGridSpec = {
    columns: [],
    focus: 'page',
    onFocus: () => undefined,
    onTurn: () => undefined,
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
      turn={null}
      isFramed
      isFocusShown={false}
      isFloating={false}
      canDrop={() => isRoomy}
    />,
  );
  return { onMove };
};

type PointerParams = {
  readonly type: string;
  readonly x: number;
  readonly y: number;
};

const pointer = ({ type, x, y }: PointerParams) => {
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0 }));
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
  fireEvent.pointerDown(source, { clientX: 200, clientY: 20, button: 0 });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
});

describe('dragging a panel by its head', () => {
  it('drops the panel above another one', async () => {
    const { onMove } = renderGrid();

    pressTerminal();
    pointer({ type: 'pointermove', x: 600, y: 50 });
    await nextFrame();

    expect(document.body.getAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe('move');
    expect(screen.getByText('Above')).toBeTruthy();

    pointer({ type: 'pointerup', x: 600, y: 50 });

    expect(onMove).toHaveBeenCalledWith({
      key: 'terminal',
      target: { at: 'above', key: 'browser' },
    });
    expect(document.body.hasAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe(false);
  });

  it('says No room and drops nothing where the page would lose its room', async () => {
    const { onMove } = renderGrid({ isRoomy: false });

    pressTerminal();
    pointer({ type: 'pointermove', x: 600, y: 50 });
    await nextFrame();

    expect(screen.getAllByText('No room').length).toBeGreaterThan(0);
    pointer({ type: 'pointerup', x: 600, y: 50 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('cancels with Esc', async () => {
    const { onMove } = renderGrid();

    pressTerminal();
    pointer({ type: 'pointermove', x: 600, y: 50 });
    await nextFrame();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    pointer({ type: 'pointerup', x: 600, y: 50 });

    expect(onMove).not.toHaveBeenCalled();
    expect(document.querySelector('[data-dock-drop]')).toBeNull();
  });

  it('starts nothing under 4px, so a click on the head stays a click', () => {
    const { onMove } = renderGrid();

    pressTerminal();
    pointer({ type: 'pointermove', x: 202, y: 21 });
    pointer({ type: 'pointerup', x: 202, y: 21 });

    expect(onMove).not.toHaveBeenCalled();
    expect(document.body.hasAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe(false);
  });
});
