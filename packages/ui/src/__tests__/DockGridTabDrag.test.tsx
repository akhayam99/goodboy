// @vitest-environment happy-dom

import { createRef } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockGrid } from '../components/DockGrid';
import { DockPanelHead } from '../components/DockPanelHead';
import type { DockGridCell, DockGridSpec } from '../dockGridSpec';
import { SPLIT_DRAG_ATTRIBUTE } from '../splitDragAttribute';

const RECTS: Readonly<Record<string, DOMRect>> = {
  terminal: new DOMRect(0, 0, 400, 600),
  browser: new DOMRect(412, 0, 400, 600),
};

const TERMINAL: DockGridCell = {
  key: 'terminal',
  sizing: 'side',
  label: 'Terminal',
  tabs: {
    keys: ['terminal', 'scripts'],
    active: 'terminal',
    members: [{ key: 'scripts', sizing: 'side', label: 'Scripts' }],
  },
};

const BROWSER: DockGridCell = { key: 'browser', sizing: 'browser', label: 'Browser' };

const renderGrid = () => {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: Element,
  ) {
    if (this.hasAttribute('data-dock-grid')) {
      return new DOMRect(0, 0, 812, 600);
    }
    const key = this.getAttribute('data-dock-pane');
    return key === null ? original.call(this) : (RECTS[key] ?? original.call(this));
  });
  const onMove = vi.fn();
  const spec: DockGridSpec = {
    columns: [[TERMINAL], [BROWSER]],
    focus: 'terminal',
    onFocus: () => undefined,
    onTurn: () => undefined,
    onMove,
  };
  render(
    <DockGrid
      gridRef={createRef<HTMLDivElement>()}
      spec={spec}
      cell={<DockPanelHead title="Panel" onClose={() => undefined} />}
      columns={[
        {
          width: 400,
          dragMax: 600,
          panes: [{ key: 'terminal', weight: 1, tabs: ['terminal', 'scripts'] }],
        },
        { width: 400, dragMax: 600, panes: [{ key: 'browser', weight: 1 }] },
      ]}
      handles={[]}
      turn={null}
      isFramed
      isFocusShown={false}
      isFloating={false}
      canDrop={() => true}
      boxesOf={() => null}
    />,
  );
  return { onMove };
};

const pointer = ({
  type,
  x,
  y,
}: {
  readonly type: string;
  readonly x: number;
  readonly y: number;
}) => {
  act(() => {
    window.dispatchEvent(
      new MouseEvent(type, {
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
      }),
    );
  });
};

const nextFrame = async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
});

describe('dragging from the head of a cell with tabs', () => {
  it('moves only that panel when a tab segment is the handle', async () => {
    const { onMove } = renderGrid();
    const tab = document.querySelector<HTMLElement>('[data-dock-tab="scripts"]');
    if (tab === null) {
      throw new Error('the Scripts tab is drawn');
    }

    fireEvent.pointerDown(tab, { clientX: 100, clientY: 20, button: 0, buttons: 1 });
    pointer({ type: 'pointermove', x: 600, y: 300 });
    await nextFrame();
    pointer({ type: 'pointerup', x: 600, y: 300 });

    expect(onMove).toHaveBeenCalledWith({
      key: 'scripts',
      unit: 'panel',
      target: { at: 'tab', key: 'browser' },
    });
  });

  it('moves the whole cell when the empty part of the head is the handle', async () => {
    const { onMove } = renderGrid();
    const head = document.querySelector<HTMLElement>(
      '[data-dock-pane="terminal"] [data-dock-panel-head]',
    );
    if (head === null) {
      throw new Error('the head is drawn');
    }

    fireEvent.pointerDown(head, { clientX: 380, clientY: 20, button: 0, buttons: 1 });
    pointer({ type: 'pointermove', x: 600, y: 300 });
    await nextFrame();
    pointer({ type: 'pointerup', x: 600, y: 300 });

    expect(onMove).toHaveBeenCalledWith({
      key: 'terminal',
      unit: 'cell',
      target: { at: 'tab', key: 'browser' },
    });
  });

  it('says how many panels the chip carries when the whole cell moves', async () => {
    renderGrid();
    const head = document.querySelector<HTMLElement>(
      '[data-dock-pane="terminal"] [data-dock-panel-head]',
    );
    if (head === null) {
      throw new Error('the head is drawn');
    }

    fireEvent.pointerDown(head, { clientX: 380, clientY: 20, button: 0, buttons: 1 });
    pointer({ type: 'pointermove', x: 20, y: 300 });
    await nextFrame();

    expect(document.querySelector('[data-dock-chip]')?.textContent).toBe('2 panels');
  });
});
