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

const TERMINAL: DockGridCell = { key: 'terminal', sizing: 'side', label: 'Terminal' };
const SCRIPTS: DockGridCell = { key: 'scripts', sizing: 'side', label: 'Scripts' };
const ASK: DockGridCell = { key: 'ask', sizing: 'side', label: 'Ask' };
const BROWSER: DockGridCell = { key: 'browser', sizing: 'browser', label: 'Browser' };

type RenderParams = {
  readonly isFolded?: boolean;
  readonly isStill?: boolean;
  readonly isRefused?: boolean;
  readonly scope?: string;
};

const renderGrid = ({
  isFolded = false,
  isStill = false,
  isRefused = false,
  scope = 'session-a',
}: RenderParams = {}) => {
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
  const onMove = vi.fn(() => (isRefused ? Promise.resolve(false) : Promise.resolve(true)));
  const spec: DockGridSpec = {
    columns: isFolded ? [[TERMINAL, SCRIPTS, ASK], [BROWSER]] : [[TERMINAL], [BROWSER]],
    focus: 'terminal',
    scope,
    onFocus: () => undefined,
    onMove,
  };
  const boxes = [
    {
      width: 400,
      dragMax: 600,
      panes: [
        {
          key: 'terminal',
          weight: 1,
          ...(isFolded && { tabs: ['terminal', 'scripts', 'ask'] }),
        },
      ],
    },
    { width: 400, dragMax: 600, panes: [{ key: 'browser', weight: 1 }] },
  ];
  const ref = createRef<HTMLDivElement>();
  const gridOf = ({ next }: { readonly next: string }) => (
    <DockGrid
      gridRef={ref}
      spec={{ ...spec, scope: next }}
      cell={<DockPanelHead title="Panel" onClose={() => undefined} />}
      columns={[
        {
          width: 400,
          dragMax: 600,
          panes: [
            {
              key: 'terminal',
              weight: 1,
              ...(isFolded && { tabs: ['terminal', 'scripts', 'ask'] }),
            },
          ],
        },
        { width: 400, dragMax: 600, panes: [{ key: 'browser', weight: 1 }] },
      ]}
      handles={[]}
      isFramed
      isFocusShown={false}
      isFloating={false}
      canDrop={() => true}
      boxesOf={() => (isStill ? boxes : null)}
    />
  );
  const view = render(gridOf({ next: scope }));
  return {
    onMove,
    changeScope: ({ next }: { readonly next: string }) => view.rerender(gridOf({ next })),
  };
};

const headOf = (key: string): HTMLElement => {
  const head = document.querySelector<HTMLElement>(
    `[data-dock-pane="${key}"] [data-dock-panel-head]`,
  );
  if (head === null) {
    throw new Error(`the head of ${key} is drawn`);
  }
  return head;
};

const keyOnFocus = (key: string): void => {
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key });
  });
};

const statusOf = (): string => document.querySelector('[data-dock-status]')?.textContent ?? '';

const noteOf = (): string => document.querySelector('[data-dock-note]')?.textContent ?? '';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
});

describe('moving a panel with the keyboard', () => {
  it('reaches the head with Tab and names it', () => {
    renderGrid();
    const head = headOf('browser');

    expect(head.tabIndex).toBe(0);
    expect(head.getAttribute('aria-label')).toBe('Move Panel');
  });

  it('lifts on Enter, announces it, and walks the cards with the arrows', () => {
    renderGrid();
    const head = headOf('browser');
    head.focus();

    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });

    expect(document.querySelector('[data-dock-drop]')).not.toBeNull();
    expect(noteOf()).toContain('lifted');
    expect(statusOf()).toContain('Esc to cancel');

    keyOnFocus('ArrowRight');

    expect(statusOf()).toMatch(/^Place left of the dock, 1 of \d+/);

    keyOnFocus('ArrowRight');

    expect(statusOf()).toMatch(/, 2 of \d+/);
  });

  it('drops on Enter on the chosen card and says where it went', async () => {
    const { onMove } = renderGrid();
    const head = headOf('browser');
    head.focus();
    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });
    keyOnFocus('ArrowRight');

    keyOnFocus('Enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(onMove).toHaveBeenCalledWith({
      key: 'browser',
      unit: 'cell',
      target: { at: 'beside', key: 'terminal', side: 'before' },
      isKeyboard: true,
    });
    expect(document.querySelector('[data-dock-drop]')).toBeNull();
    expect(noteOf()).toContain('Moved browser');
    expect(noteOf()).toContain('Place left of the dock');
  });

  it('drops nothing on Enter before a card is chosen', () => {
    const { onMove } = renderGrid();
    const head = headOf('browser');
    head.focus();
    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });

    keyOnFocus('Enter');

    expect(onMove).not.toHaveBeenCalled();
    expect(document.querySelector('[data-dock-drop]')).not.toBeNull();
  });

  it('cancels on Escape, moves nothing and gives the focus back to the head', () => {
    const { onMove } = renderGrid();
    const head = headOf('browser');
    head.focus();
    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });
    keyOnFocus('ArrowRight');

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(onMove).not.toHaveBeenCalled();
    expect(document.querySelector('[data-dock-drop]')).toBeNull();
    expect(noteOf()).toContain('cancelled');
    expect(document.activeElement).toBe(head);
  });

  it('cancels when the focus leaves the grid', () => {
    const { onMove } = renderGrid();
    const head = headOf('browser');
    head.focus();
    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    act(() => {
      outside.focus();
    });

    expect(onMove).not.toHaveBeenCalled();
    expect(document.querySelector('[data-dock-drop]')).toBeNull();
    outside.remove();
  });

  it('ignores a held key and any key that is not Enter or Space on the head', () => {
    renderGrid();
    const head = headOf('browser');
    head.focus();

    act(() => {
      fireEvent.keyDown(head, { key: 'a' });
      fireEvent.keyDown(head, { key: 'Enter', repeat: true });
    });

    expect(document.querySelector('[data-dock-drop]')).toBeNull();
  });
});

describe('a lift that outlives its context', () => {
  it('cancels when the session scope of the grid changes', () => {
    const { onMove, changeScope } = renderGrid();
    const head = headOf('browser');
    head.focus();
    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });
    keyOnFocus('ArrowRight');

    act(() => {
      changeScope({ next: 'session-b' });
    });

    expect(document.querySelector('[data-dock-drop]')).toBeNull();
    keyOnFocus('Enter');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('says the panel did not move when the move is refused', async () => {
    renderGrid({ isRefused: true });
    const head = headOf('browser');
    head.focus();
    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });
    keyOnFocus('ArrowRight');

    keyOnFocus('Enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(noteOf()).toContain('did not move');
    expect(noteOf()).not.toContain('Moved');
  });

  it('keeps where the user went when the focus leaves the grid', () => {
    renderGrid();
    const head = headOf('browser');
    head.focus();
    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    act(() => {
      outside.focus();
    });

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});

describe('the names of a folded cell', () => {
  it('names a tab by its own label, not by the label of the panel that is shown', () => {
    renderGrid({ isFolded: true });
    const tab = document.querySelector<HTMLElement>('[data-dock-tab="scripts"]');
    if (tab === null) {
      throw new Error('the Scripts tab is drawn');
    }
    tab.focus();

    act(() => {
      fireEvent.keyDown(tab, { key: 'Enter', shiftKey: true });
    });

    expect(noteOf()).toContain('Scripts lifted');
  });
});

describe('a move that the solver would undo', () => {
  it('offers no card, and says there is no other place', () => {
    const { onMove } = renderGrid({ isFolded: true, isStill: true });
    const head = headOf('terminal');
    head.focus();

    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });

    expect(document.querySelector('[data-dock-drop]')).toBeNull();
    expect(noteOf()).toContain('no other place');
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('moving a tab of a cell the solver folded with the keyboard', () => {
  it('lifts the tab that is shown, not the whole fold, from the head', () => {
    const { onMove } = renderGrid({ isFolded: true });
    const head = headOf('terminal');
    head.focus();

    act(() => {
      fireEvent.keyDown(head, { key: 'Enter' });
    });
    keyOnFocus('ArrowRight');
    keyOnFocus('Enter');

    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'terminal', unit: 'panel' }),
    );
  });

  it('lifts the tab it is on with Shift Enter', () => {
    const { onMove } = renderGrid({ isFolded: true });
    const tab = document.querySelector<HTMLElement>('[data-dock-tab="scripts"]');
    if (tab === null) {
      throw new Error('the Scripts tab is drawn');
    }
    tab.focus();

    act(() => {
      fireEvent.keyDown(tab, { key: 'Enter', shiftKey: true });
    });

    expect(noteOf()).toContain('Scripts lifted');
    keyOnFocus('ArrowRight');
    keyOnFocus('Enter');

    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ key: 'scripts', unit: 'panel' }));
  });

  it('does not lift on a plain Enter on a tab, which selects it', () => {
    renderGrid({ isFolded: true });
    const tab = document.querySelector<HTMLElement>('[data-dock-tab="scripts"]');
    if (tab === null) {
      throw new Error('the Scripts tab is drawn');
    }
    tab.focus();

    act(() => {
      fireEvent.keyDown(tab, { key: 'Enter' });
    });

    expect(document.querySelector('[data-dock-drop]')).toBeNull();
  });
});
