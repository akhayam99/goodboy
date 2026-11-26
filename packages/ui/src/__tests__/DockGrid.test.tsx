// @vitest-environment happy-dom

import { createRef, useContext, type ReactElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockGrid } from '../components/DockGrid';
import { cellTabsOf } from '../dockCellTabsOf';
import { DockCellContext } from '../dockCellContext';
import { DockDragContext } from '../dockDragContext';
import { DockTabsContext, type DockTabs } from '../dockTabsContext';
import type { DockGridCell, DockGridSpec } from '../dockGridSpec';
import type { DockGridColumnBox } from '../dockGridColumnBox';

const TERMINAL: DockGridCell = { key: 'terminal', sizing: 'side', label: 'Terminal' };
const SCRIPTS: DockGridCell = { key: 'scripts', sizing: 'side', label: 'Scripts' };
const ASK: DockGridCell = { key: 'ask', sizing: 'side', label: 'Ask' };
const BROWSER: DockGridCell = { key: 'browser', sizing: 'browser', label: 'Browser' };

const tabbed = ({ active }: { readonly active: string }): DockGridCell => ({
  ...TERMINAL,
  tabs: { keys: ['terminal', 'scripts', 'ask'], active, members: [SCRIPTS, ASK] },
});

const boxesOf = ({
  tabs,
}: {
  readonly tabs: ReadonlyArray<string>;
}): ReadonlyArray<DockGridColumnBox> => [
  { width: 420, dragMax: 600, panes: [{ key: 'terminal', weight: 1, tabs }] },
  { width: 520, dragMax: 900, panes: [{ key: 'browser', weight: 1 }] },
];

type Seen = {
  shown: string;
  tabs: DockTabs | null;
  isDragSource: boolean;
  isBrowserDragSource: boolean;
};

const seen: Seen = {
  shown: '',
  tabs: null,
  isDragSource: false,
  isBrowserDragSource: false,
};

const Probe = () => {
  const key = useContext(DockCellContext);
  const tabs = useContext(DockTabsContext);
  const source = useContext(DockDragContext);
  if (key === 'browser') {
    seen.isBrowserDragSource = source !== null;
    return <p>browser</p>;
  }
  seen.shown = key ?? '';
  seen.tabs = tabs;
  seen.isDragSource = source !== null;
  return <p data-testid="shown">{key}</p>;
};

type Params = {
  readonly spec: DockGridSpec;
  readonly tabs: ReadonlyArray<string>;
};

const gridOf = ({ spec, tabs }: Params): ReactElement => (
  <DockGrid
    gridRef={createRef<HTMLDivElement>()}
    spec={spec}
    cell={<Probe />}
    columns={boxesOf({ tabs })}
    handles={[]}
    turn={null}
    isFramed
    isFocusShown
    isFloating={false}
    canDrop={() => true}
  />
);

const specOf = (columns: DockGridSpec['columns'], onFocus = vi.fn()): DockGridSpec => ({
  columns,
  focus: 'page',
  onFocus,
  onTurn: () => undefined,
  onMove: () => undefined,
});

afterEach(() => {
  cleanup();
  seen.tabs = null;
});

describe('a cell with a chosen tab list', () => {
  it('shows the tab the cell holds as active and selects another on a click', () => {
    const onFocus = vi.fn();
    render(
      gridOf({
        spec: specOf([[tabbed({ active: 'scripts' }), BROWSER]], onFocus),
        tabs: ['terminal', 'scripts', 'ask'],
      }),
    );

    expect(screen.getByTestId('shown').textContent).toBe('scripts');
    expect(screen.getByRole('tab', { name: 'Scripts' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));

    expect(onFocus).toHaveBeenCalledWith({ key: 'ask' });
  });

  it('keeps the tab the user selected when focus leaves the cell and comes back', () => {
    const tabs = ['terminal', 'scripts', 'ask'];
    const view = render(gridOf({ spec: specOf([[tabbed({ active: 'scripts' }), BROWSER]]), tabs }));

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    view.rerender(
      gridOf({
        spec: { ...specOf([[tabbed({ active: 'scripts' }), BROWSER]]), focus: 'ask' },
        tabs,
      }),
    );
    view.rerender(
      gridOf({
        spec: { ...specOf([[tabbed({ active: 'scripts' }), BROWSER]]), focus: 'browser' },
        tabs,
      }),
    );

    expect(screen.getByTestId('shown').textContent).toBe('ask');
  });

  it('follows the active tab the spec changes to', () => {
    const tabs = ['terminal', 'scripts', 'ask'];
    const view = render(gridOf({ spec: specOf([[tabbed({ active: 'scripts' }), BROWSER]]), tabs }));
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));

    view.rerender(gridOf({ spec: specOf([[tabbed({ active: 'terminal' }), BROWSER]]), tabs }));

    expect(screen.getByTestId('shown').textContent).toBe('terminal');
  });

  it('falls back to a tab that is left when the active one closes', () => {
    const tabs = ['terminal', 'scripts', 'ask'];
    const view = render(gridOf({ spec: specOf([[tabbed({ active: 'scripts' }), BROWSER]]), tabs }));
    expect(screen.getByTestId('shown').textContent).toBe('scripts');

    const closed: DockGridCell = {
      ...TERMINAL,
      tabs: { keys: ['terminal', 'ask'], active: 'scripts', members: [ASK] },
    };
    view.rerender(gridOf({ spec: specOf([[closed, BROWSER]]), tabs: ['terminal', 'ask'] }));

    expect(screen.getByTestId('shown').textContent).toBe('terminal');
    expect(screen.queryByRole('tab', { name: 'Scripts' })).toBeNull();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Terminal', 'Ask']);
  });

  it('shows a plain panel when one tab is left', () => {
    const view = render(
      gridOf({
        spec: specOf([[tabbed({ active: 'scripts' }), BROWSER]]),
        tabs: ['terminal', 'scripts', 'ask'],
      }),
    );

    view.rerender(gridOf({ spec: specOf([[TERMINAL, BROWSER]]), tabs: ['terminal'] }));

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByTestId('shown').textContent).toBe('terminal');
  });

  it('drops a select for a key that closed after the strip drew it', () => {
    const onFocus = vi.fn();
    const tabs = ['terminal', 'scripts', 'ask'];
    const view = render(
      gridOf({ spec: specOf([[tabbed({ active: 'scripts' }), BROWSER]], onFocus), tabs }),
    );
    const late = seen.tabs?.onSelect;
    expect(late).toBeDefined();

    const closed: DockGridCell = {
      ...TERMINAL,
      tabs: { keys: ['terminal', 'ask'], active: 'ask', members: [ASK] },
    };
    view.rerender(
      gridOf({ spec: specOf([[closed, BROWSER]], onFocus), tabs: ['terminal', 'ask'] }),
    );
    late?.({ key: 'scripts' });

    expect(onFocus).not.toHaveBeenCalled();
  });

  it('reads the count of its tabs from one function, in the badge and in the strip', () => {
    const tabs = ['terminal', 'scripts', 'ask'];
    const spec = specOf([[tabbed({ active: 'terminal' }), BROWSER]]);
    render(gridOf({ spec, tabs }));

    const counted = cellTabsOf({ spec, pane: { key: 'terminal', tabs }, focus: 'page' }).count;
    const badge = document
      .querySelector('[data-dock-pane="terminal"]')
      ?.getAttribute('data-dock-tab-count');
    expect(Number(badge)).toBe(counted);
    expect(screen.getAllByRole('tab')).toHaveLength(counted);
    expect(counted).toBe(3);
  });

  it('moves with its head, tabs and all, unlike a cell the solver folded', () => {
    const tabs = ['terminal', 'scripts', 'ask'];
    const view = render(
      gridOf({ spec: specOf([[tabbed({ active: 'terminal' }), BROWSER]]), tabs }),
    );
    expect(seen.isDragSource).toBe(true);
    expect(seen.isBrowserDragSource).toBe(true);

    view.rerender(
      gridOf({ spec: specOf([[TERMINAL, SCRIPTS, BROWSER]]), tabs: ['terminal', 'scripts'] }),
    );

    expect(seen.isDragSource).toBe(false);
  });
});
